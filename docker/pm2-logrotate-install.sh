#!/bin/sh
# Installs the pm2-logrotate module and applies its settings.
# The module brings its own dependencies, so the project's npm "overrides"
# (package.json) are applied to them too, keeping the security fixes.
set -eu

SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_PACKAGE="$SCRIPTS_DIR/../package.json"

pm2 install pm2-logrotate

OVERRIDES="$(node -p 'JSON.stringify(require(process.argv[1]).overrides)' "$PROJECT_PACKAGE")"

cd "$HOME/.pm2/modules/pm2-logrotate"
npm pkg set --json overrides="$OVERRIDES"
npm install --omit=dev --ignore-scripts --no-fund --no-audit

"$SCRIPTS_DIR/pm2-logrotate-settings.sh"
pm2 kill
