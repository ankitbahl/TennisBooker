#!/bin/bash
export NODE_PATH="$HOME/.nvm/versions/node/v20.18.0/bin/node"

$NODE_PATH /home/jellyfin/TennisBooker/build/src/book.js >> "$HOME/TennisBooker/logs/logs1.txt" 2>&1
