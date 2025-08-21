#!/bin/bash

# Build the application for production deployment
echo "Building SmartyMe Platform for production..."

# Run the vite build and esbuild
npm run build

# Copy static files to the expected server location
echo "Copying static files to server/public..."
mkdir -p server/public
cp -r dist/public/* server/public/

echo "✅ Production build completed successfully!"
echo "Files are ready for deployment at:"
echo "  - Server: dist/index.js"
echo "  - Static files: server/public/"