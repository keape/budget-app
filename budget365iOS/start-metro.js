#!/usr/bin/env node
'use strict';

// Start Metro directly, bypassing react-native CLI health checks.
// Includes the /status endpoint required by RCTBundleURLProvider.

const path = require('path');
const projectRoot = path.resolve(__dirname);
process.chdir(projectRoot);

const Metro = require(path.join(projectRoot, 'node_modules/metro'));
const { loadConfig } = require(path.join(projectRoot, 'node_modules/metro-config'));
const { createDevServerMiddleware } = require(path.join(
  projectRoot,
  'node_modules/@react-native-community/cli-server-api'
));

async function main() {
  console.log('Loading Metro config...');
  const config = await loadConfig({
    config: path.join(projectRoot, 'metro.config.js'),
    projectRoot,
  });

  const { middleware: devMiddleware } = createDevServerMiddleware({
    host: 'localhost',
    port: config.server.port,
    watchFolders: config.watchFolders,
  });

  console.log('Starting Metro server on port', config.server.port, '...');

  await Metro.runServer(config, {
    host: 'localhost',
    unstable_extraMiddleware: [devMiddleware],
    onReady: (server) => {
      console.log('Metro is ready at http://localhost:' + config.server.port);
    },
  });
}

main().catch(err => {
  console.error('Failed to start Metro:', err.message);
  process.exit(1);
});
