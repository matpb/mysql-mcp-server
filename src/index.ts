#!/usr/bin/env node
import { MCPServer } from "mcp-framework";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

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

server.start();