#!/bin/bash

# Check if an argument was provided
if [ -z "$1" ]; then
    echo "Usage: ./pack.sh <suffix>"
    echo "Example: ./pack.sh preedit"
    exit 1
fi

# Name of the output zip file using the provided suffix
ZIP_NAME="property-comparison-app_$1.zip"

# Define the desktop path
DESKTOP_PATH="$HOME/Desktop"

# Create the zip archive from within the root directory, omitting environment-specific and build artifact folders/files
zip -r "$DESKTOP_PATH/$ZIP_NAME" . -x "*.git*" "node_modules/*" ".next/*" ".DS_Store" "*.env*" "coverage/*" "out/*" "build/*" ".pnp*" ".yarn/*" ".vercel/*" "*.tsbuildinfo" "*.pem" "npm-debug.log*" "yarn-debug.log*" "yarn-error.log*" ".pnpm-debug.log*" "package_for_distribution.sh" ".firebase*" "apphosting.yaml"

echo "Packaging complete: $DESKTOP_PATH/$ZIP_NAME"