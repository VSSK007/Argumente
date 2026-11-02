#!/usr/bin/env bash
# Start Argumenté locally: FastAPI on :8000 and Next.js on :3000.
# Usage: ./scripts/dev.sh [--seed]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

command -v uv >/dev/null || { echo "Please install uv: https://docs.astral.sh/uv/ (curl -LsSf https://astral.sh/uv/install.sh | sh)"; exit 1; }
command -v npm >/dev/null || { echo "Please install Node.js 20.9+ (https://nodejs.org)"; exit 1; }

# Optional API settings (e.g. ANTHROPIC_API_KEY, SMTP_HOST) from services/api/.env
if [ -f "$ROOT/services/api/.env" ]; then set -a; . "$ROOT/services/api/.env"; set +a; fi
# Local development: instant dev sign-in and a demo moderator. Real deployments leave ARGUMENTE_DEV unset.
export ARGUMENTE_DEV="${ARGUMENTE_DEV:-1}"
export ADMIN_EMAILS="${ADMIN_EMAILS:-dev@demo.local}"

echo "→ Installing API dependencies"
(cd "$ROOT/services/api" && uv sync -q)
echo "→ Installing web dependencies"
(cd "$ROOT/apps/web" && { [ -d node_modules ] || npm install --no-audit --no-fund; })

if [ "${1:-}" = "--seed" ]; then
  echo "→ Seeding demo data"
  (cd "$ROOT/services/api" && uv run python -m app.seed)
fi

cleanup() { kill 0 2>/dev/null || true; }
trap cleanup EXIT INT TERM

(cd "$ROOT/services/api" && uv run uvicorn app.main:app --reload --port 8000) &
(cd "$ROOT/apps/web" && npm run dev) &

sleep 4
echo ""
echo "  Argumenté is running:  http://localhost:3000"
echo "  API docs:              http://localhost:8000/docs"
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then echo "  Engine:                Claude (ANTHROPIC_API_KEY set)"; else echo "  Engine:                offline heuristics (set ANTHROPIC_API_KEY in services/api/.env for Claude)"; fi
echo ""
wait
