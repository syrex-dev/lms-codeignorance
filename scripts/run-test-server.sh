#!/usr/bin/env bash
set -e
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

export PATH="/home/syrex/.nvm/versions/node/v24.22.0/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

if [ -f .env.test ]; then
  export $(grep -v '^#' .env.test | grep -v '^$' | xargs)
fi

exec node ./node_modules/.bin/next dev -p 3000
