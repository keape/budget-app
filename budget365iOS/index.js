import "react-native-url-polyfill/auto";
import "abort-controller/polyfill";

// Ensure common globals are available for Apple's static bundle analyzer
if (typeof global.Blob === 'undefined') { global.Blob = require('react-native/Libraries/Blob/Blob'); }
if (typeof global.FileReader === 'undefined') { global.FileReader = require('react-native/Libraries/Blob/FileReader'); }
if (typeof global.FormData === 'undefined') { global.FormData = require('react-native/Libraries/Network/FormData'); }

/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
