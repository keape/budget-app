#!/bin/sh
set -e

# Move to the React Native project root
cd $CI_PRIMARY_REPOSITORY_PATH/budget365iOS

# Install node dependencies
npm install

# Move to the ios directory
cd ios

# Install CocoaPods dependencies
pod install
