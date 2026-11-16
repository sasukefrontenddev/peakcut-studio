#!/bin/zsh
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
node engine/start.mjs
if [ $? -ne 0 ]; then
  echo "Press Return to close this window."
  read reply
fi
