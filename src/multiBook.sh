#!/bin/bash
# spins multiple processes to book
export NODE_PATH="$HOME/.nvm/versions/node/v20.18.0/bin/node"

for i in {1..1}; do
  $NODE_PATH ~/workspace/TennisBooker/src/book.js "$i" >> "$HOME/workspace/TennisBooker/logs/logs$i.txt" 2>&1 &
done
