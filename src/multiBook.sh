#!/bin/bash
# spins multiple processes to book
export NODE_PATH="$HOME/.nvm/versions/node/v20.18.0/bin/node"

$NODE_PATH ~/workspace/TennisBooker/src/book.js >> ~/workspace/TennisBooker/logs/logs1.txt 2>&1 &
$NODE_PATH ~/workspace/TennisBooker/src/book.js >> ~/workspace/TennisBooker/logs/logs2.txt 2>&1 &
$NODE_PATH ~/workspace/TennisBooker/src/book.js >> ~/workspace/TennisBooker/logs/logs3.txt 2>&1 &
$NODE_PATH ~/workspace/TennisBooker/src/book.js >> ~/workspace/TennisBooker/logs/logs4.txt 2>&1 &
$NODE_PATH ~/workspace/TennisBooker/src/book.js >> ~/workspace/TennisBooker/logs/logs5.txt 2>&1 &
