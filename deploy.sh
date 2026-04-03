#!/bin/bash
set -e
APP_DIR="/home/storypoint"
REPO="https://github.com/Enginer-Wang/storypoint.git"
PM2_NAME="storypoint"
if [ ! -d "$APP_DIR/.git" ]; then rm -rf "$APP_DIR"; git clone "$REPO" "$APP_DIR"; fi
cd "$APP_DIR" && git fetch origin main && git reset --hard origin/main
npm install && npm run build && mkdir -p data
pm2 describe "$PM2_NAME" >/dev/null 2>&1 && pm2 restart "$PM2_NAME" --update-env || pm2 start build/index.js --name "$PM2_NAME"
pm2 save && echo "Done - https://www.storypoint.top"
