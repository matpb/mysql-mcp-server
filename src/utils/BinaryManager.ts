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
    return new Promise((resolve, reject) => {
      const makeRequest = (requestUrl: string, redirectCount: number = 0) => {
        if (redirectCount > 5) {
          reject(new Error('Too many redirects'));
          return;
        }

        https.get(requestUrl, (response) => {
          // Handle redirects
          if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
            const redirectUrl = response.headers.location;
            if (!redirectUrl) {
              reject(new Error('Redirect without location header'));
              return;
            }
            makeRequest(redirectUrl, redirectCount + 1);
            return;
          }

          if (response.statusCode !== 200) {
            reject(new Error(`Download failed with status ${response.statusCode}`));
            return;
          }

          const file = createWriteStream(destPath);
          response.pipe(file);

          file.on('finish', () => {
            file.close();
            resolve();
          });

          file.on('error', (err) => {
            fs.unlink(destPath).catch(() => {});
            reject(err);
          });
        }).on('error', (err) => {
          reject(err);
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
        `Set CLOUD_SQL_PROXY_AUTO_DOWNLOAD=true to enable automatic download, ` +
        `or manually download from ${this.getDownloadUrl(version)}`
      );
    }

    await this.downloadBinary(finalPath, version);
    return finalPath;
  }
}
