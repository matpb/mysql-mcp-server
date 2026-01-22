# MySQL MCP Server

A Model Context Protocol (MCP) server for MySQL databases. Provides safe, read-only access to MySQL databases with automatic query sanitization, Google Cloud SQL Proxy support, and remote HTTP deployment options.

## Features

- **Read-Only Access**: All queries are sanitized to ensure only read operations are allowed
- **Google Cloud SQL Proxy**: Built-in support for connecting to Cloud SQL instances
- **Remote HTTP Mode**: Deploy as a remote service with API key authentication
- **Docker Support**: Production-ready Docker images for easy deployment
- **Token Optimization**: Results are automatically limited to minimize token usage

## Quick Start

### Local Usage with Claude Code

Add to your project's `.mcp.json`:

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

### Remote HTTP Server

Deploy as a remote service and connect from anywhere:

```json
{
  "mcpServers": {
    "mysql": {
      "type": "http",
      "url": "https://your-server.example.com/mcp",
      "headers": {
        "X-API-Key": "your-api-key"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `show_tables` | List all tables in the database |
| `describe_table` | Get detailed schema information for a table |
| `execute_query` | Execute any read-only SQL query |

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

#### MySQL Connection

| Variable | Default | Description |
|----------|---------|-------------|
| `MYSQL_HOST` | `localhost` | MySQL server host |
| `MYSQL_PORT` | `3306` | MySQL server port |
| `MYSQL_USER` | `root` | MySQL username |
| `MYSQL_PASSWORD` | - | MySQL password |
| `MYSQL_DATABASE` | - | Database name |
| `MYSQL_CONNECTION_LIMIT` | `10` | Connection pool size |
| `MYSQL_CONNECT_TIMEOUT` | `60000` | Connection timeout (ms) |

#### Query Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `QUERY_TIMEOUT` | `30000` | Query timeout (ms) |
| `MAX_ROWS` | `1000` | Maximum rows returned |

#### HTTP Transport (Remote Mode)

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_TRANSPORT` | `stdio` | Transport mode: `stdio` or `http-stream` |
| `MCP_PORT` | `8080` | HTTP server port |
| `API_KEYS` | - | Comma-separated API keys for authentication |
| `CORS_ORIGIN` | `*` | CORS allowed origin |

#### Google Cloud SQL Proxy

| Variable | Default | Description |
|----------|---------|-------------|
| `CLOUD_SQL_PROXY_ENABLED` | `false` | Enable Cloud SQL Proxy |
| `CLOUD_SQL_INSTANCE` | - | Instance connection name (`project:region:instance`) |
| `CLOUD_SQL_PROXY_PORT` | `3307` | Local proxy port |
| `GOOGLE_APPLICATION_CREDENTIALS` | - | Path to service account JSON |
| `CLOUD_SQL_PROXY_AUTO_DOWNLOAD` | `true` | Auto-download proxy binary |
| `CLOUD_SQL_PROXY_STARTUP_TIMEOUT` | `30000` | Startup timeout (ms) |

## Docker Deployment

### Project Structure

```
mysql-mcp-server/
├── docker/
│   ├── Dockerfile              # Standard Docker image
│   ├── Dockerfile.digitalocean # Image with baked-in credentials
│   ├── docker-compose.yml      # Docker Compose configuration
│   └── .env.example            # Docker environment template
├── src/                        # Source code
└── .env.example                # Environment template
```

### Build and Run Locally

```bash
# Copy and configure environment
cp docker/.env.example .env

# Edit .env with your settings:
# - Set API_KEYS for authentication
# - Configure MySQL connection
# - (Optional) Configure Cloud SQL Proxy

# Build and start
cd docker
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

### Deploy to Cloud Platforms

#### Step 1: Prepare Credentials (if using Cloud SQL)

```bash
# Create a service account
gcloud iam service-accounts create mysql-mcp-server \
  --display-name="MySQL MCP Server"

# Grant Cloud SQL Client role
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:mysql-mcp-server@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

# Generate key file
gcloud iam service-accounts keys create docker/service-account.json \
  --iam-account=mysql-mcp-server@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

#### Step 2: Build for AMD64

Most cloud platforms run AMD64. Build with:

```bash
docker buildx build --platform linux/amd64 \
  -f docker/Dockerfile.digitalocean \
  -t your-registry.com/mysql-mcp-server:latest \
  --push .
```

#### Step 3: Configure Environment Variables

Set these in your cloud platform:

| Variable | Value |
|----------|-------|
| `MCP_TRANSPORT` | `http-stream` |
| `MCP_PORT` | `8080` |
| `API_KEYS` | Your secure API key |
| `MYSQL_USER` | Database username |
| `MYSQL_PASSWORD` | Database password (mark as secret) |
| `MYSQL_DATABASE` | Database name |
| `CLOUD_SQL_PROXY_ENABLED` | `true` (if using Cloud SQL) |
| `CLOUD_SQL_INSTANCE` | `project:region:instance` |

#### Step 4: Connect from Claude Code

```json
{
  "mcpServers": {
    "mysql": {
      "type": "http",
      "url": "https://your-deployment-url.com/mcp",
      "headers": {
        "X-API-Key": "your-secure-api-key"
      }
    }
  }
}
```

### Test Your Deployment

```bash
curl -X POST https://your-server.com/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "X-API-Key: your-api-key" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'
```

## Google Cloud SQL Proxy

### Local Development

For local development, use Application Default Credentials:

```bash
# Install gcloud CLI
brew install google-cloud-sdk  # macOS

# Authenticate
gcloud auth application-default login
```

Then configure your `.mcp.json`:

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["-y", "@matpb/mysql-mcp-server"],
      "env": {
        "CLOUD_SQL_PROXY_ENABLED": "true",
        "CLOUD_SQL_INSTANCE": "your-project:region:instance",
        "MYSQL_USER": "your_username",
        "MYSQL_PASSWORD": "your_password",
        "MYSQL_DATABASE": "your_database"
      }
    }
  }
}
```

### Production with Service Account

```json
{
  "env": {
    "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account.json",
    "CLOUD_SQL_PROXY_ENABLED": "true",
    "CLOUD_SQL_INSTANCE": "your-project:region:instance"
  }
}
```

## Security

### Query Sanitization

The server automatically rejects:
- Data modification: `INSERT`, `UPDATE`, `DELETE`, `DROP`, `CREATE`, `ALTER`, `TRUNCATE`
- Transactions: `BEGIN`, `COMMIT`, `ROLLBACK`
- File operations: `INTO OUTFILE`, `INTO DUMPFILE`
- Lock operations: `LOCK TABLES`, `FOR UPDATE`

### Allowed Operations

- `SELECT` queries
- `SHOW` commands
- `DESCRIBE`/`DESC` commands
- `EXPLAIN` queries
- `WITH` clauses (CTEs)

### Best Practices

1. **Use HTTPS** in production (via reverse proxy or cloud platform)
2. **Generate strong API keys**: `openssl rand -hex 32`
3. **Restrict CORS** to specific domains
4. **Rotate API keys** regularly
5. **Never commit** `.env` files or service account credentials

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in stdio mode (local)
npm start

# Run in HTTP mode
MCP_TRANSPORT=http-stream API_KEYS=test-key npm start

# Watch mode
npm run watch
```

## Troubleshooting

### Cloud SQL Proxy Errors

**"could not find default credentials"**
- Run `gcloud auth application-default login`
- Or set `GOOGLE_APPLICATION_CREDENTIALS` to your service account file

**"Access denied for user"**
- Verify MySQL username/password
- Check that your service account has `Cloud SQL Client` role

### HTTP Transport Errors

**"Session not found"**
- The MCP client must send proper session headers
- Test with the MCP Inspector: `npx @modelcontextprotocol/inspector`

## License

MIT
