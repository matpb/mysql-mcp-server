# MySQL MCP Server

A read-only Model Context Protocol (MCP) server for MySQL databases. This server provides safe, read-only access to MySQL databases with automatic query sanitization to prevent any data mutations.

## Features

- **Read-Only Access**: All queries are sanitized to ensure only read operations are allowed
- **Google Cloud SQL Proxy**: Built-in support for connecting to Cloud SQL instances without IP whitelisting
- **Token Optimization**: Results are automatically limited and optimized to minimize token usage
- **Comprehensive Tools**:
  - `show_tables`: List all tables in the database
  - `describe_table`: Get detailed schema information for a specific table
  - `execute_query`: Execute any read-only SQL query

## Usage with Claude Code

Add to your project by creating a `.mcp.json` file in your project root:

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["-y", "@matpb/mysql-mcp-server"],
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

Claude Code will automatically detect and use this MCP server when you open your project.

## Installation (for local development)

**Note:** For normal usage with Claude Code, we recommend using `npx` as shown above. Local installation is only needed if you're developing or modifying the server.

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

## Google Cloud SQL Proxy

This server includes built-in support for Google Cloud SQL Proxy, allowing secure connections to Cloud SQL instances without IP whitelisting.

### Cloud SQL Configuration

Add the following to your `.mcp.json` for Cloud SQL:

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["-y", "@matpb/mysql-mcp-server"],
      "env": {
        "CLOUD_SQL_PROXY_ENABLED": "true",
        "CLOUD_SQL_INSTANCE": "project:region:instance",
        "MYSQL_USER": "your_username",
        "MYSQL_PASSWORD": "your_password",
        "MYSQL_DATABASE": "your_database"
      }
    }
  }
}
```

### Cloud SQL Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CLOUD_SQL_PROXY_ENABLED` | No | `false` | Enable Cloud SQL Proxy |
| `CLOUD_SQL_INSTANCE` | Yes* | - | Instance connection name (`project:region:instance`) |
| `CLOUD_SQL_PROXY_PORT` | No | `3307` | Local TCP port for proxy |
| `GOOGLE_APPLICATION_CREDENTIALS` | No | - | Path to service account JSON (falls back to gcloud auth) |
| `CLOUD_SQL_PROXY_BINARY` | No | auto | Custom path to proxy binary |
| `CLOUD_SQL_PROXY_AUTO_DOWNLOAD` | No | `true` | Auto-download binary if missing |
| `CLOUD_SQL_PROXY_STARTUP_TIMEOUT` | No | `30000` | Startup timeout in milliseconds |

*Required when `CLOUD_SQL_PROXY_ENABLED=true`

### Authentication

The Cloud SQL Proxy requires Google Cloud authentication. Choose one of these methods:

#### Option 1: Application Default Credentials (Recommended for Development)

This is the easiest way to get started for local development:

1. **Install the Google Cloud CLI** if you haven't already:
   - macOS: `brew install google-cloud-sdk`
   - Other platforms: <https://cloud.google.com/sdk/docs/install>

1. **Authenticate with your Google account**:

   ```bash
   gcloud auth application-default login
   ```

   This opens a browser window for you to sign in with your Google account.

1. **Verify authentication** (optional):

   ```bash
   gcloud auth application-default print-access-token
   ```

   If this prints a token, you're authenticated.

That's it! The Cloud SQL Proxy will automatically use these credentials.

#### Option 2: Service Account Key (Recommended for Production)

For production deployments or CI/CD pipelines:

1. **Create a service account** in the Google Cloud Console with the `Cloud SQL Client` role.

2. **Download the JSON key file** for the service account.

3. **Set the environment variable**:

   ```json
   {
     "env": {
       "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account-key.json",
       "CLOUD_SQL_PROXY_ENABLED": "true"
     }
   }
   ```

### Troubleshooting Authentication

If you see an error like:

```text
could not find default credentials
```

This means the proxy cannot find valid Google Cloud credentials. To fix:

1. **For local development**: Run `gcloud auth application-default login`
2. **For production**: Ensure `GOOGLE_APPLICATION_CREDENTIALS` points to a valid service account key file
3. **Verify your account has access**: Your Google account or service account needs the `Cloud SQL Client` role on the Cloud SQL instance

### How It Works

When Cloud SQL Proxy is enabled:

1. The proxy binary is automatically downloaded (Mac, Windows, Linux supported)
2. A local proxy process is started on the configured port
3. MySQL connections are routed through the secure proxy tunnel
4. The proxy is automatically stopped when the server shuts down

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
