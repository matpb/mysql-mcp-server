import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import https from 'https';
import path from 'path';
import os from 'os';

const PROXY_VERSION = 'v2.14.3';
const BASE_URL = 'https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy';

export class BinaryManager {
  /**
   * Get the platform-specific binary suffix for Cloud SQL Proxy
   */
  static getPlatformSuffix(): string {
    const platform = process.platform;
    const arch = process.arch;

    const platformMap: Record<string, Record<string, string>> = {
      darwin: {
        arm64: 'darwin.arm64',
        x64: 'darwin.amd64',
      },
      linux: {
        arm64: 'linux.arm64',
        x64: 'linux.amd64',
      },
      win32: {
        x64: 'windows.amd64.exe',
      },
    };

    const suffix = platformMap[platform]?.[arch];
    if (!suffix) {
      throw new Error(`Unsupported platform: ${platform}/${arch}. Cloud SQL Proxy supports darwin (arm64, x64), linux (arm64, x64), and win32 (x64).`);
    }
    return suffix;
  }

  /**
   * Get the default installation directory for the binary
   */
  static getDefaultInstallDir(): string {
    if (process.platform === 'win32') {
      const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      return path.join(appData, 'cloudsql-proxy');
    }
    return path.join(os.homedir(), '.cloudsql-proxy');
  }

  /**
   * Get the full path to the binary
   */
  static getBinaryPath(customPath?: string): string {
    if (customPath) {
      return customPath;
    }
    const installDir = this.getDefaultInstallDir();
    const binaryName = process.platform === 'win32' ? 'cloud-sql-proxy.exe' : 'cloud-sql-proxy';
    return path.join(installDir, binaryName);
  }

  /**
   * Get the download URL for the current platform
   */
  static getDownloadUrl(version: string = PROXY_VERSION): string {
    const suffix = this.getPlatformSuffix();
    return `${BASE_URL}/${version}/cloud-sql-proxy.${suffix}`;
  }

  /**
   * Check if the binary exists and is executable
   */
  static async binaryExists(binaryPath: string): Promise<boolean> {
    try {
      await fs.access(binaryPath, fs.constants.X_OK);
      return true;
    } catch {
      // On Windows, just check if file exists (no execute permission check)
      if (process.platform === 'win32') {
        try {
          await fs.access(binaryPath, fs.constants.F_OK);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  /**
   * Download a file from URL, following redirects
   */
  private static async downloadFile(url: string, destPath: string): Promise<void> {
    const tempPath = `${destPath}.downloading`;

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        fs.unlink(tempPath).catch(() => {});
      };

      const makeRequest = (requestUrl: string, redirectCount: number = 0) => {
        if (redirectCount > 5) {
          cleanup();
          reject(new Error('Too many redirects while downloading Cloud SQL Proxy'));
          return;
        }

        const request = https.get(requestUrl, { timeout: 30000 }, (response) => {
          // Handle redirects
          if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
            const redirectUrl = response.headers.location;
            if (!redirectUrl) {
              cleanup();
              reject(new Error('Redirect without location header'));
              return;
            }
            makeRequest(redirectUrl, redirectCount + 1);
            return;
          }

          if (response.statusCode !== 200) {
            cleanup();
            reject(new Error(
              `Failed to download Cloud SQL Proxy: HTTP ${response.statusCode}. ` +
              `URL: ${requestUrl}`
            ));
            return;
          }

          const file = createWriteStream(tempPath);
          let downloadedBytes = 0;
          const totalBytes = parseInt(response.headers['content-length'] || '0', 10);

          response.on('data', (chunk: Buffer) => {
            downloadedBytes += chunk.length;
            if (totalBytes > 0 && downloadedBytes % (5 * 1024 * 1024) < chunk.length) {
              const percent = Math.round((downloadedBytes / totalBytes) * 100);
              console.error(`[CloudSQLProxy] Download progress: ${percent}% (${Math.round(downloadedBytes / 1024 / 1024)}MB)`);
            }
          });

          response.pipe(file);

          file.on('finish', async () => {
            file.close();
            try {
              // Rename temp file to final destination
              await fs.rename(tempPath, destPath);
              resolve();
            } catch (err) {
              cleanup();
              reject(new Error(`Failed to save Cloud SQL Proxy binary: ${err}`));
            }
          });

          file.on('error', (err) => {
            cleanup();
            reject(new Error(`Failed to write Cloud SQL Proxy binary: ${err.message}`));
          });

          response.on('error', (err) => {
            file.destroy();
            cleanup();
            reject(new Error(`Download interrupted: ${err.message}`));
          });
        });

        request.on('error', (err) => {
          cleanup();
          reject(new Error(
            `Failed to download Cloud SQL Proxy: ${err.message}. ` +
            `Check your network connection.`
          ));
        });

        request.on('timeout', () => {
          request.destroy();
          cleanup();
          reject(new Error(
            'Download timed out after 30 seconds. ' +
            'Check your network connection or try again later.'
          ));
        });
      };

      makeRequest(url);
    });
  }

  /**
   * Download the Cloud SQL Proxy binary
   */
  static async downloadBinary(destPath: string, version: string = PROXY_VERSION): Promise<void> {
    const url = this.getDownloadUrl(version);
    const destDir = path.dirname(destPath);

    // Ensure directory exists
    await fs.mkdir(destDir, { recursive: true });

    console.error(`[CloudSQLProxy] Downloading binary from ${url}...`);

    await this.downloadFile(url, destPath);

    // Make executable on Unix systems
    if (process.platform !== 'win32') {
      await fs.chmod(destPath, 0o755);
    }

    console.error(`[CloudSQLProxy] Binary downloaded to ${destPath}`);
  }

  /**
   * Ensure the binary exists, downloading if necessary
   */
  static async ensureBinary(options: {
    binaryPath?: string;
    autoDownload?: boolean;
    version?: string;
  } = {}): Promise<string> {
    const { binaryPath, autoDownload = true, version = PROXY_VERSION } = options;
    const finalPath = this.getBinaryPath(binaryPath);

    if (await this.binaryExists(finalPath)) {
      console.error(`[CloudSQLProxy] Using existing binary at ${finalPath}`);
      return finalPath;
    }

    if (!autoDownload) {
      throw new Error(
        `Cloud SQL Proxy binary not found at ${finalPath}. ` +
        `Either set CLOUD_SQL_PROXY_AUTO_DOWNLOAD=true to enable automatic download, ` +
        `set CLOUD_SQL_PROXY_BINARY to point to an existing binary, ` +
        `or manually download from ${this.getDownloadUrl(version)}`
      );
    }

    console.error(`[CloudSQLProxy] Binary not found at ${finalPath}, downloading...`);

    await this.downloadBinary(finalPath, version);
    return finalPath;
  }
}
