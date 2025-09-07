import mysql from 'mysql2/promise';
import { config } from '../config.js';

export class MySQLManager {
  private static instance: MySQLManager;
  private pool: mysql.Pool | null = null;

  private constructor() {}

  public static getInstance(): MySQLManager {
    if (!MySQLManager.instance) {
      MySQLManager.instance = new MySQLManager();
    }
    return MySQLManager.instance;
  }

  public async getConnection(): Promise<mysql.Pool> {
    if (!this.pool) {
      this.pool = mysql.createPool({
        host: config.mysql.host,
        port: config.mysql.port,
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
  }
}

export const mysqlManager = MySQLManager.getInstance();