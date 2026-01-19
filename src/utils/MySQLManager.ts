import mysql from 'mysql2/promise';
import { config } from '../config.js';
import { CloudSQLProxy } from './CloudSQLProxy.js';

export class MySQLManager {
  private static instance: MySQLManager;
  private pool: mysql.Pool | null = null;
  private cloudSqlProxy: CloudSQLProxy | null = null;

  private constructor() {}

  public static getInstance(): MySQLManager {
    if (!MySQLManager.instance) {
      MySQLManager.instance = new MySQLManager();
    }
    return MySQLManager.instance;
  }

  /**
   * Start Cloud SQL Proxy if enabled
   */
  private async startCloudSqlProxy(): Promise<void> {
    if (this.cloudSqlProxy) {
      return;
    }

    this.cloudSqlProxy = new CloudSQLProxy({
      instanceConnectionName: config.cloudSqlProxy.instanceConnectionName,
      port: config.cloudSqlProxy.port,
      credentialsFile: config.cloudSqlProxy.credentialsFile || undefined,
      binaryPath: config.cloudSqlProxy.binaryPath || undefined,
      autoDownload: config.cloudSqlProxy.autoDownload,
      startupTimeout: config.cloudSqlProxy.startupTimeout,
    });

    await this.cloudSqlProxy.start();
  }

  /**
   * Stop Cloud SQL Proxy if running
   */
  private async stopCloudSqlProxy(): Promise<void> {
    if (this.cloudSqlProxy) {
      await this.cloudSqlProxy.stop();
      this.cloudSqlProxy = null;
    }
  }

  /**
   * Get connection configuration based on whether Cloud SQL Proxy is enabled
   */
  private getConnectionConfig(): { host: string; port: number } {
    if (config.cloudSqlProxy.enabled && this.cloudSqlProxy) {
      return this.cloudSqlProxy.getConnectionConfig();
    }
    return {
      host: config.mysql.host,
      port: config.mysql.port,
    };
  }

  public async getConnection(): Promise<mysql.Pool> {
    if (!this.pool) {
      // Start Cloud SQL Proxy if enabled
      if (config.cloudSqlProxy.enabled) {
        await this.startCloudSqlProxy();
      }

      const connectionConfig = this.getConnectionConfig();

      this.pool = mysql.createPool({
        host: connectionConfig.host,
        port: connectionConfig.port,
        user: config.mysql.user,
        password: config.mysql.password,
        database: config.mysql.database,
        waitForConnections: true,
        connectionLimit: config.mysql.connectionLimit,
        queueLimit: 0,
        connectTimeout: config.mysql.connectTimeout,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
      });

      // Test connection
      try {
        const connection = await this.pool.getConnection();
        await connection.ping();
        connection.release();
      } catch (error) {
        this.pool = null;
        await this.stopCloudSqlProxy();
        throw new Error(`Failed to connect to MySQL: ${error}`);
      }
    }
    return this.pool;
  }

  public async executeQuery(query: string, params: any[] = []): Promise<any> {
    const pool = await this.getConnection();
    try {
      const [results] = await pool.execute(query, params);
      return results;
    } catch (error) {
      throw new Error(`Query execution failed: ${error}`);
    }
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    await this.stopCloudSqlProxy();
  }
}

export const mysqlManager = MySQLManager.getInstance();