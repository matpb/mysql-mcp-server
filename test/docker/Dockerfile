# Test environment without gcloud CLI or Cloud SQL Proxy
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy built files
COPY dist/ ./dist/

# Set environment variables for testing
ENV CLOUD_SQL_PROXY_ENABLED=true
ENV CLOUD_SQL_INSTANCE=test-project:us-central1:test-instance
ENV CLOUD_SQL_PROXY_AUTO_DOWNLOAD=true
ENV MYSQL_USER=testuser
ENV MYSQL_PASSWORD=testpass
ENV MYSQL_DATABASE=testdb

# Don't install gcloud or cloud-sql-proxy - we want to test the auto-download

CMD ["node", "dist/index.js"]
