#!/bin/bash

# Test scenarios for Cloud SQL Proxy integration
# Run from the project root: ./test/docker/test-scenarios.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

echo "=== Building project ==="
npm run build

echo ""
echo "=== Building Docker test image ==="
docker build -t mysql-mcp-test -f test/docker/Dockerfile .

echo ""
echo "=========================================="
echo "Test 1: Auto-download enabled (default)"
echo "=========================================="
echo "Expected: Should attempt to download the binary"
echo ""

# Run with timeout since it will try to connect
timeout 30 docker run --rm \
  -e CLOUD_SQL_PROXY_ENABLED=true \
  -e CLOUD_SQL_INSTANCE=test-project:us-central1:test-instance \
  -e CLOUD_SQL_PROXY_AUTO_DOWNLOAD=true \
  -e MYSQL_USER=test \
  -e MYSQL_PASSWORD=test \
  -e MYSQL_DATABASE=test \
  mysql-mcp-test 2>&1 || true

echo ""
echo "=========================================="
echo "Test 2: Auto-download disabled, no binary"
echo "=========================================="
echo "Expected: Should fail with clear error about missing binary"
echo ""

timeout 10 docker run --rm \
  -e CLOUD_SQL_PROXY_ENABLED=true \
  -e CLOUD_SQL_INSTANCE=test-project:us-central1:test-instance \
  -e CLOUD_SQL_PROXY_AUTO_DOWNLOAD=false \
  -e MYSQL_USER=test \
  -e MYSQL_PASSWORD=test \
  -e MYSQL_DATABASE=test \
  mysql-mcp-test 2>&1 || true

echo ""
echo "=========================================="
echo "Test 3: Invalid instance name"
echo "=========================================="
echo "Expected: Should fail with error from proxy about invalid instance"
echo ""

timeout 30 docker run --rm \
  -e CLOUD_SQL_PROXY_ENABLED=true \
  -e CLOUD_SQL_INSTANCE=invalid \
  -e CLOUD_SQL_PROXY_AUTO_DOWNLOAD=true \
  -e MYSQL_USER=test \
  -e MYSQL_PASSWORD=test \
  -e MYSQL_DATABASE=test \
  mysql-mcp-test 2>&1 || true

echo ""
echo "=========================================="
echo "Test 4: No credentials (no GOOGLE_APPLICATION_CREDENTIALS)"
echo "=========================================="
echo "Expected: Should fail with auth error from proxy"
echo ""

timeout 30 docker run --rm \
  -e CLOUD_SQL_PROXY_ENABLED=true \
  -e CLOUD_SQL_INSTANCE=real-project:us-central1:real-instance \
  -e CLOUD_SQL_PROXY_AUTO_DOWNLOAD=true \
  -e MYSQL_USER=test \
  -e MYSQL_PASSWORD=test \
  -e MYSQL_DATABASE=test \
  mysql-mcp-test 2>&1 || true

echo ""
echo "=========================================="
echo "All tests completed!"
echo "=========================================="
