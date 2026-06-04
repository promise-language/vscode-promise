#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EXT_DIR="$HOME/.vscode/extensions/promise-language"

# Install dependencies and compile if needed
if [ ! -d "$REPO_DIR/node_modules" ]; then
    echo "Installing dependencies..."
    (cd "$REPO_DIR" && npm install)
fi

if [ ! -d "$REPO_DIR/out" ]; then
    echo "Compiling extension..."
    (cd "$REPO_DIR" && npm run compile)
fi

# Remove existing link or directory
if [ -L "$EXT_DIR" ]; then
    echo "Removing existing symlink..."
    rm "$EXT_DIR"
elif [ -d "$EXT_DIR" ]; then
    echo "Removing existing directory..."
    rm -rf "$EXT_DIR"
fi

# Create symlink
ln -s "$REPO_DIR" "$EXT_DIR"
echo "Linked: $EXT_DIR -> $REPO_DIR"
echo ""
echo "Restart VS Code to load the extension."
echo "To uninstall: rm $EXT_DIR"
