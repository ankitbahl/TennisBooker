#!/bin/bash
export NODE_PATH="$HOME/.nvm/versions/node/v20.18.0/bin/node"

$NODE_PATH ~/workspace/TennisBooker/build/src/book.js >> "$HOME/workspace/TennisBooker/logs/logs1.txt" 2>&1
