#!/usr/bin/env bash

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PIDS_DIR="$ROOT/.pids"

stop_service() {
  local name="$1"
  local pid_file="$PIDS_DIR/$name.pid"

  if [ ! -f "$pid_file" ]; then
    echo "[$name] not running (no pid file)"
    return
  fi

  local pid
  pid=$(cat "$pid_file")

  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid"
    echo "[$name] stopped (pid $pid)"
  else
    echo "[$name] process $pid not found (already stopped)"
  fi

  rm -f "$pid_file"
}

stop_service backend
stop_service frontend
