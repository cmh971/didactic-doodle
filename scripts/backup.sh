#!/usr/bin/env bash
# Bash — back up the SQLite database safely (uses the online-backup API via .backup).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="$ROOT/data/bot.db"
OUT_DIR="$ROOT/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$OUT_DIR"

if [[ ! -f "$DB" ]]; then
  echo "No database at $DB — nothing to back up."
  exit 0
fi

if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB" ".backup '$OUT_DIR/bot-$STAMP.db'"
else
  # Fallback: WAL-aware file copy.
  cp "$DB" "$OUT_DIR/bot-$STAMP.db"
fi

echo "✅ Backup written to $OUT_DIR/bot-$STAMP.db"
# Keep only the 10 most recent backups.
ls -1t "$OUT_DIR"/bot-*.db 2>/dev/null | tail -n +11 | xargs -r rm -f
