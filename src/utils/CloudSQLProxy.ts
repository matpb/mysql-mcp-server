import { spawn, ChildProcess } from 'child_process';
import net from 'net';
import { BinaryManager } from './BinaryManager.js';

export interface CloudSQLProxyConfig {
  instanceConnectionName: string;
  port?: number;
  credentialsFile?: string;
  binaryPath?: string;
  autoDownload?: boolean;
  startupTimeout?: number;
}

export class CloudSQLProxy {
  private process: ChildProcess | null = null;
  private isRunning: boolean = false;
  private config: Required<Omit<CloudSQLProxyConfig, 'credentialsFile' | 'binaryPath'>> &
    Pick<CloudSQLProxyConfig, 'credentialsFile' | 'binaryPath'>;

  constructor(config: CloudSQLProxyConfig) {
    this.config = {
      instanceConnectionName: config.instanceConnectionName,
      port: config.port ?? 3307,
      credentialsFile: config.credentialsFile,
      binaryPath: config.binaryPath,
      autoDownload: config.autoDownload ?? true,
      startupTimeout: config.startupTimeout ?? 30000,
    };
  }

  /**
   * Build command-line arguments for the proxy
   */
  private buildArgs(): string[] {
    const args: string[] = [];

    // Instance connection with port binding
    // Format: INSTANCE_CONNECTION_NAME?port=PORT
    args.push(`${this.config.instanceConnectionName}?port=${this.config.port}`);

    // Add credentials file if provided
    if (this.config.credentialsFile) {
      args.push('--credentials-file', this.config.credentialsFile);
    }

    // Use structured logging for easier parsing
    args.push('--structured-logs');

    return args;
  }

  /**
   * Check if the proxy is accepting connections
   */
  private async checkConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();

      socket.setTimeout(1000);

      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(this.config.port, '127.0.0.1');
    });
  }

  /**
   * Wait for the proxy to be ready to accept connections
   */
  async waitForReady(timeout?: number): Promise<boolean> {
    const startTime = Date.now();
    const maxTime = timeout ?? this.config.startupTimeout;
    const checkInterval = 500;

    while (Date.now() - startTime < maxTime) {
      if (await this.checkConnection()) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    return false;
  }

  /**
   * Start the Cloud SQL Proxy subprocess
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.error('[CloudSQLProxy] Proxy already running');
      return;
    }

    // Validate instance connection name
    if (!this.config.instanceConnectionName) {
      throw new Error(
        'Cloud SQL instance connection name is required. ' +
        'Set CLOUD_SQL_INSTANCE environment variable (format: project:region:instance)'
      );
    }

    // Ensure binary exists
    const binaryPath = await BinaryManager.ensureBinary({
      binaryPath: this.config.binaryPath,
      autoDownload: this.config.autoDownload,
    });

    const args = this.buildArgs();

    console.error(`[CloudSQLProxy] Starting proxy: ${binaryPath} ${args.join(' ')}`);

    this.process = spawn(binaryPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    // Capture stdout
    this.process.stdout?.on('data', (data: Buffer) => {
      const message = data.toString().trim();
      if (message) {
        console.error(`[CloudSQLProxy:stdout] ${message}`);
      }
    });

    // Capture stderr
    this.process.stderr?.on('data', (data: Buffer) => {
      const message = data.toString().trim();
      if (message) {
        console.error(`[CloudSQLProxy:stderr] ${message}`);
      }
    });

    // Handle process errors
    this.process.on('error', (err) => {
      console.error(`[CloudSQLProxy] Process error: ${err.message}`);
      this.isRunning = false;
    });

    // Handle process exit
    this.process.on('exit', (code, signal) => {
      if (code !== null) {
        console.error(`[CloudSQLProxy] Process exited with code ${code}`);
      } else if (signal !== null) {
        console.error(`[CloudSQLProxy] Process killed by signal ${signal}`);
      }
      this.isRunning = false;
      this.process = null;
    });

    // Wait for proxy to be ready
    console.error(`[CloudSQLProxy] Waiting for proxy to be ready (timeout: ${this.config.startupTimeout}ms)...`);
    const ready = await this.waitForReady();

    if (!ready) {
      await this.stop();
      throw new Error(
        `Cloud SQL Proxy failed to start within ${this.config.startupTimeout}ms. ` +
        'Check credentials and instance connection name.'
      );
    }

    this.isRunning = true;
    console.error(`[CloudSQLProxy] Proxy ready on 127.0.0.1:${this.config.port}`);
  }

  /**
   * Stop the Cloud SQL Proxy subprocess
   */
  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    console.error('[CloudSQLProxy] Stopping proxy...');

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        // Force kill if graceful shutdown fails
        console.error('[CloudSQLProxy] Force killing proxy...');
        this.process?.kill('SIGKILL');
        resolve();
      }, 5000);

      this.process!.on('exit', () => {
        clearTimeout(timeout);
        this.process = null;
        this.isRunning = false;
        console.error('[CloudSQLProxy] Proxy stopped');
        resolve();
      });

      // Try graceful shutdown first
      this.process!.kill('SIGTERM');
    });
  }

  /**
   * Check if the proxy is currently running
   */
  isHealthy(): boolean {
    return this.isRunning && this.process !== null;
  }

  /**
   * Get the connection configuration for MySQL
   */
  getConnectionConfig(): { host: string; port: number } {
    return {
      host: '127.0.0.1',
      port: this.config.port,
    };
  }
}
