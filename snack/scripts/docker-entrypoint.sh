#!/usr/bin/env sh
set -e
[ "${SKIP_MIGRATIONS:-}" = "true" ] || npx prisma migrate deploy
exec node dist/src/main.js
