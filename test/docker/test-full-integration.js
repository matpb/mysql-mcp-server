#!/usr/bin/env node

/**
 * Full integration test for Cloud SQL Proxy
 * Tests: binary download, proxy startup, error handling
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import https from 'https';
import { createWriteStream } from 'fs';
import net from 'net';

const PROXY_VERSION = 'v2.14.3';
const BASE_URL = 'https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy';

// ============================================
// BinaryManager functions (copied from source)
// ============================================

function getPlatformSuffix() {
  const platform = process.platform;
  const arch = process.arch;

  const platformMap = {
    darwin: { arm64: 'darwin.arm64', x64: 'darwin.amd64' },
    linux: { arm64: 'linux.arm64', x64: 'linux.amd64' },
    win32: { x64: 'windows.amd64.exe' },
  };

  const suffix = platformMap[platform]?.[arch];
  if (!suffix) {
    throw new Error(`Unsupported platform: ${platform}/${arch}`);
  }
  return suffix;
}

function getDownloadUrl() {
  const suffix = getPlatformSuffix();
  return `${BASE_URL}/${PROXY_VERSION}/cloud-sql-proxy.${suffix}`;
}

async function downloadBinary(destPath) {
  const url = getDownloadUrl();
  const tempPath = `${destPath}.downloading`;
  const destDir = path.dirname(destPath);

  await fs.mkdir(destDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const cleanup = () => fs.unlink(tempPath).catch(() => {});

    const request = https.get(url, { timeout: 60000 }, async (response) => {
      if (response.statusCode !== 200) {
        cleanup();
        reject(new Error(`Download failed: HTTP ${response.statusCode}`));
        return;
      }

      const file = createWriteStream(tempPath);
      response.pipe(file);

      file.on('finish', async () => {
        file.close();
        try {
          await fs.rename(tempPath, destPath);
          await fs.chmod(destPath, 0o755);
          resolve();
        } catch (err) {
          cleanup();
          reject(err);
        }
      });

      file.on('error', (err) => {
        cleanup();
        reject(err);
      });
    });

    request.on('error', (err) => {
      cleanup();
      reject(new Error(`Download failed: ${err.message}`));
    });

    request.on('timeout', () => {
      request.destroy();
      cleanup();
      reject(new Error('Download timeout'));
    });
  });
}

// ============================================
// CloudSQLProxy functions (copied from source)
// ============================================

function checkConnection(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('error', () => { socket.destroy(); resolve(false); });
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
    socket.connect(port, '127.0.0.1');
  });
}

async function startProxy(binaryPath, instanceName, port = 3307) {
  const args = [`${instanceName}?port=${port}`, '--structured-logs'];

  console.log(`  Starting: ${binaryPath} ${args.join(' ')}`);

  const proc = spawn(binaryPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  let lastError = '';
  let processExited = false;
  let exitCode = null;

  proc.stdout?.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) {
      console.log(`  [stdout] ${msg}`);
      try {
        const log = JSON.parse(msg);
        if (log.level === 'error' || log.level === 'fatal') {
          lastError = log.message || log.msg || msg;
        }
      } catch {}
    }
  });

  proc.stderr?.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) {
      console.log(`  [stderr] ${msg}`);
      lastError = msg;
    }
  });

  proc.on('error', (err) => {
    console.log(`  [error] ${err.message}`);
    lastError = err.message;
    processExited = true;
  });

  proc.on('exit', (code) => {
    console.log(`  [exit] code=${code}`);
    processExited = true;
    exitCode = code;
  });

  // Wait for ready or failure
  const startTime = Date.now();
  const timeout = 15000;

  while (Date.now() - startTime < timeout) {
    if (processExited) {
      return { success: false, error: lastError || `Exited with code ${exitCode}`, proc: null };
    }
    if (await checkConnection(port)) {
      return { success: true, error: null, proc };
    }
    await new Promise(r => setTimeout(r, 500));
  }

  proc.kill('SIGTERM');
  return { success: false, error: lastError || 'Timeout waiting for proxy', proc: null };
}

// ============================================
// Test Cases
// ============================================

async function runTests() {
  const testDir = path.join(os.tmpdir(), `cloudsql-integration-test-${Date.now()}`);
  const binaryPath = path.join(testDir, 'cloud-sql-proxy');

  console.log('=== Cloud SQL Proxy Integration Tests ===\n');
  console.log(`Test directory: ${testDir}`);
  console.log(`Platform: ${process.platform}/${process.arch}\n`);

  const results = [];

  // Test 1: Download binary
  console.log('--- Test 1: Download Binary ---');
  try {
    console.log(`  Downloading from: ${getDownloadUrl()}`);
    const start = Date.now();
    await downloadBinary(binaryPath);
    console.log(`  ✓ Download completed in ${((Date.now() - start) / 1000).toFixed(1)}s`);
    results.push({ name: 'Download Binary', passed: true });
  } catch (err) {
    console.log(`  ✗ Download failed: ${err.message}`);
    results.push({ name: 'Download Binary', passed: false, error: err.message });
    console.log('\n=== Cannot continue without binary ===');
    return;
  }

  // Test 2: Binary execution
  console.log('\n--- Test 2: Binary Execution ---');
  try {
    const result = await new Promise((resolve, reject) => {
      const proc = spawn(binaryPath, ['--version'], { stdio: 'pipe' });
      let output = '';
      proc.stdout.on('data', d => output += d);
      proc.stderr.on('data', d => output += d);
      proc.on('close', code => code === 0 ? resolve(output.trim()) : reject(new Error(`Exit code ${code}`)));
      proc.on('error', reject);
    });
    console.log(`  ✓ Version: ${result}`);
    results.push({ name: 'Binary Execution', passed: true });
  } catch (err) {
    console.log(`  ✗ Failed: ${err.message}`);
    results.push({ name: 'Binary Execution', passed: false, error: err.message });
  }

  // Test 3: Invalid instance name
  console.log('\n--- Test 3: Invalid Instance Name ---');
  console.log('  Expected: Should fail with error about invalid instance');
  const test3 = await startProxy(binaryPath, 'invalid-instance-name', 3310);
  if (!test3.success && test3.error) {
    console.log(`  ✓ Got expected error: ${test3.error.substring(0, 100)}...`);
    results.push({ name: 'Invalid Instance Name', passed: true });
  } else {
    console.log(`  ✗ Should have failed but didn't`);
    results.push({ name: 'Invalid Instance Name', passed: false });
    test3.proc?.kill('SIGTERM');
  }

  // Test 4: Valid format but no credentials
  console.log('\n--- Test 4: No Credentials ---');
  console.log('  Expected: Should fail with auth error');
  const test4 = await startProxy(binaryPath, 'my-project:us-central1:my-instance', 3311);
  if (!test4.success && test4.error) {
    console.log(`  ✓ Got expected error: ${test4.error.substring(0, 100)}...`);
    results.push({ name: 'No Credentials', passed: true });
  } else {
    console.log(`  ✗ Should have failed but didn't`);
    results.push({ name: 'No Credentials', passed: false });
    test4.proc?.kill('SIGTERM');
  }

  // Cleanup
  console.log('\n--- Cleanup ---');
  try {
    await fs.rm(testDir, { recursive: true });
    console.log('  ✓ Cleaned up test directory');
  } catch (err) {
    console.log(`  ✗ Cleanup failed: ${err.message}`);
  }

  // Summary
  console.log('\n=== Test Summary ===');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(r => {
    console.log(`  ${r.passed ? '✓' : '✗'} ${r.name}${r.error ? `: ${r.error}` : ''}`);
  });

  console.log(`\nTotal: ${passed} passed, ${failed} failed`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
