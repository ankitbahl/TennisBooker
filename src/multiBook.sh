#!/bin/bash
# spins multiple processes to book
export NODE_PATH="$HOME/.nvm/versions/node/v20.18.0/bin/node"
export DISPLAY=:99
Xvfb :99 -screen 0 1024x768x24 &
XVFB_PID=$!
sleep 2

$NODE_PATH ~/workspace/TennisBooker/src/book.js >> "$HOME/workspace/TennisBooker/logs/logs1.txt" 2>&1
kill $XVFB_PID
