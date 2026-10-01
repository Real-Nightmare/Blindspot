#!/bin/sh
# Blindspot dev stack: local Convex backend (persistent) + Vite frontend.
# The managed preview runs this script; Vite takes the port from $PORT.
set -e

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
mkdir -p "$ROOT/.vly-run"

# 1. Stop any backend we started earlier so `convex dev --once` can push.
#    (The CLI manages its own short-lived backend during push and refuses to
#    run while port 3210 is occupied.) Function/schema state persists in
#    .convex/local/default, so restarting is safe.
if [ -f "$ROOT/.vly-run/convex.pid" ]; then
  OLDPID="$(cat "$ROOT/.vly-run/convex.pid" 2>/dev/null || true)"
  if [ -n "$OLDPID" ] && kill -0 "$OLDPID" 2>/dev/null; then
    echo "[dev] stopping previous Convex backend (pid $OLDPID)..."
    kill "$OLDPID" 2>/dev/null || true
    i=0
    while curl -s -o /dev/null --max-time 1 "http://127.0.0.1:3210/" 2>/dev/null && [ "$i" -lt 10 ]; do
      i=$((i + 1))
      sleep 1
    done
  fi
fi

# 2. Push the current functions once (also regenerates _generated types).
echo "[dev] pushing Convex functions..."
cd "$ROOT"
npx convex dev --once || echo "[dev] WARNING: convex push failed; see .vly-run/convex-push.log"

# 3. Start the persistent local Convex backend on :3210.
CONVEX_BIN="$(ls -t "$HOME/.cache/convex/binaries"/*/convex-local-backend 2>/dev/null | head -1 || true)"
if [ -z "$CONVEX_BIN" ]; then
  echo "[dev] ERROR: convex-local-backend binary not found; run 'bun convex dev --once' first" >&2
  exit 1
fi
LOCAL_DIR="$ROOT/.convex/local/default"
mkdir -p "$LOCAL_DIR"
if [ ! -f "$LOCAL_DIR/config.json" ]; then
  echo "[dev] ERROR: $LOCAL_DIR/config.json missing; run 'bun convex dev --once' first" >&2
  exit 1
fi
INSTANCE_SECRET="$(node -p "JSON.parse(require('fs').readFileSync('$LOCAL_DIR/config.json','utf8')).instanceSecret")"
cd "$LOCAL_DIR"
nohup "$CONVEX_BIN" \
  --instance-name anonymous-codebase \
  --instance-secret "$INSTANCE_SECRET" \
  > "$ROOT/.vly-run/convex.log" 2>&1 &
echo $! > "$ROOT/.vly-run/convex.pid"
cd "$ROOT"
i=0
while ! curl -s -o /dev/null --max-time 2 "http://127.0.0.1:3210/" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "[dev] Convex backend did not come up; continuing anyway (see .vly-run/convex.log)"
    break
  fi
  sleep 1
done
if curl -s -o /dev/null --max-time 2 "http://127.0.0.1:3210/" 2>/dev/null; then
  echo "[dev] Convex backend is up on :3210"
fi

# 4. Run Vite in the foreground (managed preview owns this process).
echo "[dev] starting Vite..."
exec bun run dev:frontend
