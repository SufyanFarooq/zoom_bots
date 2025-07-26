#!/bin/bash

# Install Chromium on Railway
echo "Installing Chromium..."

# Update package list
apt-get update

# Install Chromium
apt-get install -y chromium-browser

# Set environment variable
echo "CHROMIUM_PATH=/usr/bin/chromium-browser" >> .env

echo "Chromium installation completed!" 