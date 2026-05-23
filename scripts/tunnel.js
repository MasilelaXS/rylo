#!/usr/bin/env node
/**
 * Starts a Cloudflare tunnel (free, no account needed) and launches Expo.
 * Uses EXPO_PACKAGER_PROXY_URL to point Expo at the public tunnel URL.
 */

const { spawn } = require('child_process');
const { tunnel } = require('cloudflared');

async function main() {
  console.log('Starting Cloudflare tunnel to localhost:8081...');

  let expoProcess;

  // Use the Try Cloudflare quick tunnel (no account needed)
  const tunnelProcess = tunnel(['tunnel', '--url', 'http://localhost:8081']);

  tunnelProcess.on('url', (url) => {
    console.log('\n========================================');
    console.log(`Tunnel URL: ${url}`);
    console.log('Scan the QR code below to open in Expo Go');
    console.log('========================================\n');

    // Start Expo with the cloudflared URL as the proxy
    expoProcess = spawn(
      'npx',
      ['expo', 'start', '--lan'],
      {
        env: {
          ...process.env,
          EXPO_PACKAGER_PROXY_URL: url,
        },
        stdio: 'inherit',
        shell: true,
      }
    );

    expoProcess.on('exit', (code) => {
      tunnelProcess.process.kill();
      process.exit(code || 0);
    });
  });

  tunnelProcess.on('error', (err) => {
    console.error('Tunnel error:', err.message);
    process.exit(1);
  });

  const cleanup = () => {
    if (expoProcess) expoProcess.kill();
    tunnelProcess.process.kill();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
