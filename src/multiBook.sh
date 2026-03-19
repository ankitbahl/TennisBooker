#!/bin/bash
export NODE_PATH="$HOME/.nvm/versions/node/v22.22.0/bin/node"

$NODE_PATH /home/jellyfin/projects/TennisBooker/build/src/book.js >> "$HOME/projects/TennisBooker/logs/logs1.txt" 2>&1
