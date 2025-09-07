import dotenv from 'dotenv';

dotenv.config();

export const config = {
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || '',
    connectionLimit: parseInt(process.env.MYSQL_CONNECTION_LIMIT || '10', 10),
    connectTimeout: parseInt(process.env.MYSQL_CONNECT_TIMEOUT || '60000', 10),
  },
  query: {
    timeout: parseInt(process.env.QUERY_TIMEOUT || '30000', 10),
    maxRows: parseInt(process.env.MAX_ROWS || '1000', 10),
  },
  server: {
    name: 'MySQL MCP Server',
    version: '1.0.0',
  },
};