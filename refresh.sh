#!/usr/bin/env bash
# Refresh the deep dive: public sources and live contract reads -> incremental Arbitrum event pull -> build ->
# fact gate -> headless render check. Any failing step exits non-zero; the page keeps the last good data.
#   ENVIO_API_TOKEN or ENVIO_TOKEN_FILE   free Envio HyperSync token (chain pull; skipped with a warning if unset)
#   NODE_PATH, CHROME                      where playwright and a Chromium live (render check; skipped if absent)
set -uo pipefail
cd "$(dirname "$0")"
fail() { echo "FAILED: $1" >&2; exit 1; }
[ -f local.env ] && { set -a; . ./local.env; set +a; }
uv run -q --with pycryptodome python pipeline/fetch_public.py || fail "public fetch crashed"
if [ -n "${ENVIO_API_TOKEN:-}${ENVIO_TOKEN_FILE:-}" ]; then
  uv run -q pipeline/fetch_chain.py >/dev/null || fail "chain pull failed"
else
  echo "warning: no Envio token, chain data not updated" >&2
fi
uv run -q pipeline/build.py >/dev/null || fail "build failed"
uv run -q python pipeline/check_facts.py || fail "fact gate failed"
if node -e "require('playwright')" 2>/dev/null; then
  PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1])')
  python3 -m http.server "$PORT" --bind 127.0.0.1 --directory site >/dev/null 2>&1 & SRV=$!
  for _ in $(seq 1 50); do curl -s -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.2; done
  node tools/render_check.cjs "http://127.0.0.1:$PORT/"; RC=$?
  kill $SRV 2>/dev/null
  [ $RC -eq 0 ] || fail "render check failed"
fi
echo "refreshed: $(grep -o '"as_of":"[^"]*"' site/data/data.js | head -1)"
