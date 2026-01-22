import { MCPTool } from "mcp-framework";
import { z } from "zod";
import { mysqlManager } from "../utils/MySQLManager.js";

interface DescribeTableInput {
  table: string;
}

class DescribeTableTool extends MCPTool<DescribeTableInput> {
  name = "describe_table";
  description = "Get detailed schema information for a specific table";

  schema = {
    table: {
      type: z.string(),
      description: "Name of the table to describe",
    },
  };

  async execute(input: DescribeTableInput) {
    try {
      // Validate table name to prevent SQL injection
      const tableName = input.table.replace(/[^a-zA-Z0-9_]/g, '');
      
      // Get column information
      const columns = await mysqlManager.executeQuery(
        `DESCRIBE \`${tableName}\``
      );

      // Get indexes
      const indexes = await mysqlManager.executeQuery(
        `SHOW INDEX FROM \`${tableName}\``
      );

      // Get table status for additional info
      const tableStatus = await mysqlManager.executeQuery(
        `SHOW TABLE STATUS LIKE '${tableName}'`
      );

      // Format column information
      const formattedColumns = columns.map((col: any) => ({
        field: col.Field,
        type: col.Type,
        nullable: col.Null === 'YES',
        key: col.Key,
        default: col.Default,
        extra: col.Extra,
      }));

      // Format index information
      const indexMap = new Map();
      indexes.forEach((idx: any) => {
        if (!indexMap.has(idx.Key_name)) {
          indexMap.set(idx.Key_name, {
            name: idx.Key_name,
            unique: !idx.Non_unique,
            columns: [],
          });
        }
        indexMap.get(idx.Key_name).columns.push({
          column: idx.Column_name,
          sequence: idx.Seq_in_index,
        });
      });

      const formattedIndexes = Array.from(indexMap.values());

      // Extract table metadata
      const metadata = tableStatus[0] ? {
        engine: tableStatus[0].Engine,
        rows: tableStatus[0].Rows,
        dataLength: tableStatus[0].Data_length,
        indexLength: tableStatus[0].Index_length,
        createTime: tableStatus[0].Create_time,
        updateTime: tableStatus[0].Update_time,
        collation: tableStatus[0].Collation,
        comment: tableStatus[0].Comment,
      } : null;

      return {
        table: tableName,
        columns: formattedColumns,
        indexes: formattedIndexes,
        metadata,
        summary: `Table '${tableName}' has ${formattedColumns.length} columns and ${formattedIndexes.length} indexes`,
      };
    } catch (error) {
      return {
        error: `Failed to describe table '${input.table}': ${error}`,
      };
    }
  }
}

export default DescribeTableTool;