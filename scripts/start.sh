#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PIDS_DIR="$ROOT/.pids"
mkdir -p "$PIDS_DIR"

BACKEND_PID_FILE="$PIDS_DIR/backend.pid"
FRONTEND_PID_FILE="$PIDS_DIR/frontend.pid"
BACKEND_LOG="$PIDS_DIR/backend.log"
FRONTEND_LOG="$PIDS_DIR/frontend.log"

# --- backend ---
if [ -f "$BACKEND_PID_FILE" ] && kill -0 "$(cat "$BACKEND_PID_FILE")" 2>/dev/null; then
  echo "[backend] already running (pid $(cat "$BACKEND_PID_FILE"))"
else
  echo "[backend] starting..."
  DOTENV_CONFIG_PATH="$ROOT/backend/.env.local" \
  NODE_ENV=development \
    "$ROOT/backend/node_modules/.bin/tsx" "$ROOT/backend/src/index.ts" \
    > "$BACKEND_LOG" 2>&1 &
  BACKEND_PID=$!
  echo "$BACKEND_PID" > "$BACKEND_PID_FILE"
  echo "[backend] started (pid $BACKEND_PID) → log: $BACKEND_LOG"
fi

# --- frontend ---
if [ -f "$FRONTEND_PID_FILE" ] && kill -0 "$(cat "$FRONTEND_PID_FILE")" 2>/dev/null; then
  echo "[frontend] already running (pid $(cat "$FRONTEND_PID_FILE"))"
else
  echo "[frontend] starting..."
  "$ROOT/node_modules/.bin/next" dev "$ROOT/frontend" --turbo \
    > "$FRONTEND_LOG" 2>&1 &
  FRONTEND_PID=$!
  echo "$FRONTEND_PID" > "$FRONTEND_PID_FILE"
  echo "[frontend] started (pid $FRONTEND_PID) → log: $FRONTEND_LOG"
fi

echo ""
echo "Backend:  http://localhost:3001"
echo "Frontend: http://localhost:3000"
echo ""
echo "Logs:"
echo "  tail -f $BACKEND_LOG"
echo "  tail -f $FRONTEND_LOG"
echo ""
echo "Stop: ./scripts/stop.sh"
