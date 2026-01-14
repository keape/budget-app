#!/bin/sh
set -e

# Homebrew is available in Xcode Cloud. Ensure Node.js is installed.
if ! command -v npm &> /dev/null
then
    echo "npm not found, installing node via Homebrew..."
    brew install node
fi

# Move to the React Native project root
cd $CI_PRIMARY_REPOSITORY_PATH/budget365iOS

# Install node dependencies
npm install

# Move to the ios directory
cd ios

# Install CocoaPods dependencies
pod install
