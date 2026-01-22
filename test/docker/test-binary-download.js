#!/usr/bin/env node

/**
 * Test script to verify BinaryManager download behavior
 * Run inside Docker container or on any machine
 */

import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import https from 'https';
import path from 'path';
import os from 'os';

const PROXY_VERSION = 'v2.14.3';
const BASE_URL = 'https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy';

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

async function testDownload() {
  console.log('=== Binary Download Test ===\n');

  console.log('Platform:', process.platform);
  console.log('Architecture:', process.arch);

  try {
    const suffix = getPlatformSuffix();
    console.log('Platform suffix:', suffix);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }

  const url = getDownloadUrl();
  console.log('Download URL:', url);

  const testDir = path.join(os.tmpdir(), `cloudsql-test-${Date.now()}`);
  const testPath = path.join(testDir, 'cloud-sql-proxy');
  const tempPath = `${testPath}.downloading`;

  console.log('\nTest directory:', testDir);
  console.log('Binary path:', testPath);

  // Create directory
  try {
    await fs.mkdir(testDir, { recursive: true });
    console.log('✓ Created test directory');
  } catch (e) {
    console.error('✗ Failed to create directory:', e.message);
    process.exit(1);
  }

  // Test download
  console.log('\nStarting download...');
  const startTime = Date.now();

  return new Promise((resolve) => {
    const cleanup = async () => {
      try {
        await fs.rm(testDir, { recursive: true });
      } catch {}
    };

    const request = https.get(url, { timeout: 60000 }, async (response) => {
      console.log('Response status:', response.statusCode);

      if (response.statusCode !== 200) {
        console.error('✗ Download failed with status', response.statusCode);
        await cleanup();
        process.exit(1);
      }

      const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
      console.log('Content-Length:', totalBytes, 'bytes', `(${Math.round(totalBytes / 1024 / 1024)}MB)`);

      const file = createWriteStream(tempPath);
      let downloadedBytes = 0;
      let lastProgress = 0;

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        const progress = Math.round((downloadedBytes / totalBytes) * 100);
        if (progress >= lastProgress + 10) {
          console.log(`  Progress: ${progress}% (${Math.round(downloadedBytes / 1024 / 1024)}MB)`);
          lastProgress = progress;
        }
      });

      response.pipe(file);

      file.on('finish', async () => {
        file.close();

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n✓ Download completed in ${duration}s`);

        // Rename temp to final
        try {
          await fs.rename(tempPath, testPath);
          console.log('✓ Renamed temp file to final path');
        } catch (e) {
          console.error('✗ Failed to rename:', e.message);
          await cleanup();
          process.exit(1);
        }

        // Make executable
        try {
          await fs.chmod(testPath, 0o755);
          console.log('✓ Made binary executable');
        } catch (e) {
          console.error('✗ Failed to chmod:', e.message);
        }

        // Verify file
        try {
          const stats = await fs.stat(testPath);
          console.log('✓ Binary size:', stats.size, 'bytes');

          if (stats.size !== totalBytes) {
            console.error('✗ Size mismatch! Expected:', totalBytes);
            await cleanup();
            process.exit(1);
          }
        } catch (e) {
          console.error('✗ Failed to stat:', e.message);
          await cleanup();
          process.exit(1);
        }

        // Test execution
        console.log('\nTesting binary execution...');
        const { spawn } = await import('child_process');
        const proc = spawn(testPath, ['--version'], { stdio: 'pipe' });

        let output = '';
        proc.stdout.on('data', (data) => { output += data.toString(); });
        proc.stderr.on('data', (data) => { output += data.toString(); });

        proc.on('close', async (code) => {
          if (code === 0) {
            console.log('✓ Binary executed successfully');
            console.log('  Version:', output.trim());
          } else {
            console.error('✗ Binary execution failed with code', code);
            console.error('  Output:', output);
          }

          await cleanup();
          console.log('\n=== Test Complete ===');
          resolve();
        });

        proc.on('error', async (err) => {
          console.error('✗ Failed to execute binary:', err.message);
          await cleanup();
          process.exit(1);
        });
      });

      file.on('error', async (err) => {
        console.error('✗ File write error:', err.message);
        await cleanup();
        process.exit(1);
      });
    });

    request.on('error', async (err) => {
      console.error('✗ Request error:', err.message);
      await cleanup();
      process.exit(1);
    });

    request.on('timeout', async () => {
      console.error('✗ Request timeout');
      request.destroy();
      await cleanup();
      process.exit(1);
    });
  });
}

testDownload();
