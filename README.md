# MySQL MCP Server

A read-only Model Context Protocol (MCP) server for MySQL databases. This server provides safe, read-only access to MySQL databases with automatic query sanitization to prevent any data mutations.

## Features

- **Read-Only Access**: All queries are sanitized to ensure only read operations are allowed
- **Token Optimization**: Results are automatically limited and optimized to minimize token usage
- **Comprehensive Tools**:
  - `show_tables`: List all tables in the database
  - `describe_table`: Get detailed schema information for a specific table
  - `execute_query`: Execute any read-only SQL query

## Installation

```bash
npm install
```

## Configuration

1. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

2. Configure your MySQL connection settings in `.env`:

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=your_username
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=your_database

# Optional settings
MYSQL_CONNECTION_LIMIT=10
MYSQL_CONNECT_TIMEOUT=60000
QUERY_TIMEOUT=30000
MAX_ROWS=1000
```

## Building

```bash
npm run build
```

## Usage with Claude Desktop

Add to your Claude Desktop configuration:

### macOS

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["@matpb/mysql-mcp-server"],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "your_username",
        "MYSQL_PASSWORD": "your_password",
        "MYSQL_DATABASE": "your_database"
      }
    }
  }
}
```

### Windows

Edit `%APPDATA%\Claude\claude_desktop_config.json` with the same configuration.

## Security Features

### Query Sanitization

The server automatically rejects queries containing:

- INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, TRUNCATE
- Transaction commands (BEGIN, COMMIT, ROLLBACK)
- File operations (INTO OUTFILE, INTO DUMPFILE)
- Lock operations (LOCK TABLES, FOR UPDATE)

### Allowed Operations

- SELECT queries
- SHOW commands (SHOW TABLES, SHOW DATABASES, etc.)
- DESCRIBE/DESC commands
- EXPLAIN queries
- WITH clauses (CTEs)
- SET @ (session variables only)

## Tool Examples

### Show Tables

Lists all tables in the current database.

### Describe Table

Get detailed schema information including columns, indexes, and metadata for a specific table.

### Execute Query

Execute any read-only SQL query with automatic sanitization and result limiting.

## Development

```bash
# Watch mode for development
npm run watch

# Start the server
npm start
```

## Token Optimization Strategies

1. **Automatic Result Limiting**: All SELECT queries are automatically limited to prevent large result sets
2. **Compact Schema Format**: Database schema is returned in a compact, token-efficient format
3. **Buffer Handling**: Binary data is represented as byte count instead of full content

## Error Handling

- Connection failures are gracefully handled with clear error messages
- Query timeouts prevent long-running queries
- Invalid queries are rejected with specific error descriptions

## License

MIT
