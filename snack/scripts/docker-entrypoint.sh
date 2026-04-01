#!/usr/bin/env sh
set -e
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Set it in Render (or your host) to your Aiven mysql://... URL." >&2
  exit 1
fi
case "$DATABASE_URL" in
  *localhost*|*127.0.0.1*)
    echo "DATABASE_URL points at localhost/127.0.0.1; the container has no DB there. Use your cloud MySQL host (e.g. Aiven)." >&2
    exit 1
    ;;
esac
[ "${SKIP_MIGRATIONS:-}" = "true" ] || npx prisma migrate deploy
exec node dist/src/main.js
