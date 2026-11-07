#!/bin/sh
# The production container's command (E12-3): bring the database up to date,
# load the built-in themes, then serve. If a step fails, the container stops
# with a non-zero exit code, so CapRover and Docker don't switch over to it.
set -eu

# An SQLite file that isn't on a volume lives in the container itself, and
# the next upgrade, which replaces the container, deletes it.
case "${DATABASE_URL:-}" in
  file:*)
    db=$(printf '%s' "${DATABASE_URL#file:}" | sed 's/?.*//; s#//*#/#g')
    dir=$db
    while [ "$dir" != / ] && ! awk -v dir="$dir" '$5 == dir { found = 1 } END { exit !found }' /proc/self/mountinfo; do
      dir=$(dirname "$dir")
    done
    if [ "$dir" = / ]; then
      echo "WARNING: the SQLite database, $db, isn't on a volume, so it's deleted with this container, at the next upgrade at the latest. Mount a volume on its folder, e.g. docker run -v dossier-data:$(dirname "$db") ..." >&2
    fi
    ;;
esac

cd /app/tools
if ! node node_modules/prisma/build/index.js migrate deploy; then
  echo "Jobs Ireland didn't start: applying the database migrations failed (see the error above). See Troubleshooting: https://github.com/chrisnol6073/dossier/blob/main/docs/help/Troubleshooting.md" >&2
  exit 1
fi
if ! node seed.mjs; then
  echo "Jobs Ireland didn't start: loading the built-in themes failed (see the error above)." >&2
  exit 1
fi

cd /app
exec node server.js
