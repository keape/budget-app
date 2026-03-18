#!/usr/bin/env node
'use strict';

// Start Metro directly, bypassing react-native CLI and its broken health checks.
// Adds a manual /status endpoint required by RCTBundleURLProvider.

const path = require('path');
const projectRoot = path.resolve(__dirname);
process.chdir(projectRoot);

const Metro = require(path.join(projectRoot, 'node_modules/metro'));
const { loadConfig } = require(path.join(projectRoot, 'node_modules/metro-config'));

async function main() {
  console.log('Loading Metro config...');
  const config = await loadConfig({
    config: path.join(projectRoot, 'metro.config.js'),
    projectRoot,
  });

  const port = config.server?.port ?? 8081;
  console.log('Starting Metro server on port', port, '...');

  // Simple connect middleware that adds the /status endpoint
  // (required by RCTBundleURLProvider.isPackagerRunning)
  const connect = require(path.join(projectRoot, 'node_modules/connect'));
  const app = connect();
  app.use('/status', (_req, res) => {
    res.setHeader('X-React-Native-Project-Root', projectRoot);
    res.end('packager-status:running');
  });

  await Metro.runServer(config, {
    host: 'localhost',
    unstable_extraMiddleware: [app],
    onReady: () => {
      console.log('Metro is ready at http://localhost:' + port);
      console.log('Status endpoint: http://localhost:' + port + '/status');
    },
  });
}

main().catch(err => {
  console.error('Failed to start Metro:', err.message);
  console.error(err.stack);
  process.exit(1);
});
