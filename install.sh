#!/bin/bash
# RafayGen CLI (rgcli) Installation Script

echo "Installing RafayGen CLI..."

# Check for Node.js
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed. Please install Node.js first."
    exit 1
fi

echo "Installing rgcli globally via npm..."
npm install -g rgcli

echo ""
echo "=================================================="
echo "✔ RafayGen CLI installed successfully!"
echo "=================================================="
echo ""
echo "To get started, authenticate with your web app:"
echo "  rgcli login <your-token>"
echo ""
echo "Then ask RafayGen to code anything:"
echo "  rgcli ask \"build a simple python web server\""
echo ""
echo "For advanced users (Apt/Snap/Brew):"
echo "  sudo snap install rgcli"
echo "  sudo apt install rgcli"
echo "  brew install rgcli"
echo "*(Native binary distribution coming soon via CI/CD pipelines)*"
