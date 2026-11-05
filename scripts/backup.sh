#!/usr/bin/env bash
# Back up the database. Usage: DATABASE_URL=... ./scripts/backup.sh [output_dir]
#   postgresql://… (or postgresql+psycopg://…)  -> pg_dump custom-format file (restore with pg_restore)
#   sqlite:///path/to.db                         -> consistent copy via SQLite's online backup API
# Keeps the newest 14 backups in the output directory.
set -euo pipefail
OUT="${1:-./backups}"
URL="${DATABASE_URL:-sqlite:///./services/api/argumente.db}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$OUT"

case "$URL" in
  postgres*)
    PGURL="${URL/postgresql+psycopg:/postgresql:}"
    command -v pg_dump >/dev/null || { echo "pg_dump not found (install the postgresql client)"; exit 1; }
    FILE="$OUT/argumente-$STAMP.dump"
    pg_dump --format=custom --no-owner --file "$FILE" "$PGURL"
    ;;
  sqlite:///*)
    SRC="${URL#sqlite:///}"
    FILE="$OUT/argumente-$STAMP.sqlite"
    python3 - "$SRC" "$FILE" <<'PY'
import sqlite3, sys
src, dst = sqlite3.connect(sys.argv[1]), sqlite3.connect(sys.argv[2])
src.backup(dst); dst.close(); src.close()
PY
    ;;
  *) echo "Unsupported DATABASE_URL: $URL"; exit 1 ;;
esac

chmod 600 "$FILE"
# Prune: keep the 14 newest
ls -1t "$OUT"/argumente-* 2>/dev/null | tail -n +15 | xargs -r rm -f --
echo "Backup written: $FILE ($(du -h "$FILE" | cut -f1))"
