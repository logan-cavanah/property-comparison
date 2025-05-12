#!/bin/bash

# Name of the output zip file (edit as needed)
ZIP_NAME="property-comparison-app_preedit.zip"

# Define the desktop path
DESKTOP_PATH="$HOME/Desktop"

# Create the zip archive from within the root directory, omitting environment-specific and build artifact folders/files
zip -r "$DESKTOP_PATH/$ZIP_NAME" . -x "*.git*" "node_modules/*" ".next/*" ".DS_Store" "*.env*" "coverage/*" "out/*" "build/*" ".pnp*" ".yarn/*" ".vercel/*" "*.tsbuildinfo" "*.pem" "npm-debug.log*" "yarn-debug.log*" "yarn-error.log*" ".pnpm-debug.log*" "package_for_distribution.sh"

echo "Packaging complete: $DESKTOP_PATH/$ZIP_NAME" 