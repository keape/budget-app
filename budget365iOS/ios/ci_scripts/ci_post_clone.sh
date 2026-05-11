#!/bin/sh
set -e
set -x

# Move to the React Native project root
cd $CI_PRIMARY_REPOSITORY_PATH/budget365iOS

# Ensure Node is installed and available
if ! command -v node > /dev/null 2>&1
then
    brew install node@20
    brew link node@20
fi

# Print versions for debugging
node --version
npm --version
ruby --version
gem --version

# Install dependencies with legacy-peer-deps to avoid resolution issues
npm install --legacy-peer-deps

# Create .xcode.env.local for Xcode Cloud environment
echo "export NODE_BINARY=$(command -v node)" > ios/.xcode.env.local

# Move to the ios directory
cd ios

# Print CocoaPods version for debugging
pod --version

# Install CocoaPods
pod install

