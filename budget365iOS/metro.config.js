const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  // Watchman hangs on external APFS volumes with `noowners` (this repo lives on /Volumes/Ext.Lexar).
  // Fall back to node-watcher; small perf hit, big stability win.
  resolver: {
    useWatchman: false,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
