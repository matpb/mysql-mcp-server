#!/usr/bin/env node
import { MCPServer } from "mcp-framework";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mysqlManager } from "./utils/MySQLManager.js";

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json
const packageJsonPath = join(__dirname, "..", "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

const server = new MCPServer({
  name: packageJson.name,
  version: packageJson.version,
  basePath: __dirname  // Explicitly set the base path to the dist directory
});

// Graceful shutdown handler
const shutdown = async (signal: string) => {
  console.error(`[Server] Received ${signal}, shutting down gracefully...`);
  try {
    await mysqlManager.close();
    console.error('[Server] MySQL connection and Cloud SQL Proxy closed');
  } catch (error) {
    console.error(`[Server] Error during shutdown: ${error}`);
  }
  process.exit(0);
};

// Register signal handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGHUP', () => shutdown('SIGHUP'));

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
  console.error(`[Server] Uncaught exception: ${error}`);
  try {
    await mysqlManager.close();
  } catch (closeError) {
    console.error(`[Server] Error closing connection: ${closeError}`);
  }
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  console.error(`[Server] Unhandled rejection: ${reason}`);
  try {
    await mysqlManager.close();
  } catch (closeError) {
    console.error(`[Server] Error closing connection: ${closeError}`);
  }
  process.exit(1);
});

server.start();