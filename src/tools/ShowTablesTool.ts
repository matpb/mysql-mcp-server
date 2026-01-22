import { MCPTool } from "mcp-framework";
import { z } from "zod";
import { mysqlManager } from "../utils/MySQLManager.js";

interface ShowTablesInput {}

class ShowTablesTool extends MCPTool<ShowTablesInput> {
  name = "show_tables";
  description = "List all tables in the current database";

  schema = {};

  async execute(input: ShowTablesInput) {
    try {
      const results = await mysqlManager.executeQuery('SHOW TABLES');
      
      if (!results || results.length === 0) {
        return {
          tables: [],
          message: "No tables found in the database",
        };
      }

      // Extract table names from results
      const tables = results.map((row: any) => {
        const key = Object.keys(row)[0];
        return row[key];
      });

      return {
        tables,
        count: tables.length,
        message: `Found ${tables.length} table(s)`,
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: Failed to list tables: ${error}`
          }
        ]
      };
    }
  }
}

export default ShowTablesTool;