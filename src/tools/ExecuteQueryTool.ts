import { MCPTool } from "mcp-framework";
import { z } from "zod";
import { mysqlManager } from "../utils/MySQLManager.js";
import { QuerySanitizer } from "../utils/QuerySanitizer.js";
import { config } from "../config.js";

interface ExecuteQueryInput {
  query: string;
  limit?: number;
}

class ExecuteQueryTool extends MCPTool<ExecuteQueryInput> {
  name = "execute_query";
  description = "Execute a read-only SQL query with automatic sanitization";

  schema = {
    query: {
      type: z.string(),
      description: "SQL query to execute (read-only operations only)",
    },
    limit: {
      type: z.number().optional(),
      description: `Maximum number of rows to return (default: ${config.query.maxRows})`,
    },
  };

  async execute(input: ExecuteQueryInput) {
    try {
      // Sanitize the query
      const sanitizationResult = QuerySanitizer.sanitize(input.query);
      
      if (!sanitizationResult.isValid) {
        return {
          success: false,
          error: sanitizationResult.error,
          message: "Query rejected: This appears to be a mutation operation. Only read-only queries are allowed.",
        };
      }

      // Apply row limit if not already present
      const limit = input.limit || config.query.maxRows;
      let finalQuery = sanitizationResult.sanitizedQuery;
      
      // Check if query already has LIMIT clause
      if (!/\bLIMIT\s+\d+/i.test(finalQuery)) {
        // Only add LIMIT to SELECT queries
        if (/^\s*SELECT\s+/i.test(finalQuery)) {
          finalQuery = `${finalQuery} LIMIT ${limit}`;
        }
      }

      // Execute the query with timeout
      const startTime = Date.now();
      const results = await Promise.race([
        mysqlManager.executeQuery(finalQuery),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), config.query.timeout)
        ),
      ]);
      const executionTime = Date.now() - startTime;

      // Handle different result types
      if (Array.isArray(results)) {
        // SELECT query results
        const rowCount = results.length;
        const truncated = rowCount === limit;

        return {
          success: true,
          data: results,
          rowCount,
          truncated,
          executionTime: `${executionTime}ms`,
          message: truncated 
            ? `Query executed successfully. Showing first ${limit} rows.`
            : `Query executed successfully. ${rowCount} row(s) returned.`,
        };
      } else {
        // Non-SELECT query results (SHOW, DESCRIBE, etc.)
        return {
          success: true,
          data: results,
          executionTime: `${executionTime}ms`,
          message: "Query executed successfully.",
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: "Query execution failed.",
      };
    }
  }

}

export default ExecuteQueryTool;