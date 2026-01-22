# Production Dockerfile for MySQL MCP Server
# Includes Node.js, Google Cloud SDK, Python, and Cloud SQL Proxy

FROM node:20-slim AS base

# Install dependencies for gcloud CLI and Cloud SQL Proxy
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    python3 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Google Cloud SDK
RUN curl -sSL https://sdk.cloud.google.com | bash -s -- --disable-prompts --install-dir=/opt
ENV PATH="/opt/google-cloud-sdk/bin:${PATH}"

# Pre-download Cloud SQL Proxy for Linux (amd64)
RUN mkdir -p /usr/local/bin && \
    curl -L https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.1/cloud-sql-proxy.linux.amd64 \
    -o /usr/local/bin/cloud-sql-proxy && \
    chmod +x /usr/local/bin/cloud-sql-proxy

# Build stage
FROM base AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source (context is parent directory)
COPY src/ ./src/
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Production stage
FROM base AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Set Cloud SQL Proxy binary path so it doesn't try to download
ENV CLOUD_SQL_PROXY_BINARY=/usr/local/bin/cloud-sql-proxy

# Default to HTTP transport for Docker deployment
ENV MCP_TRANSPORT=http-stream
ENV MCP_PORT=8080

# Expose the MCP port
EXPOSE 8080

# Run the server
CMD ["node", "dist/index.js"]
