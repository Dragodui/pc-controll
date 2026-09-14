#!/usr/bin/env bash
# Full check: host preflight, then simulated phone session, then server log review.
# Usage: ./scripts/test-phone.sh [scenario...]
set -u
cd "$(dirname "$0")/.."
CONTAINER="${CONTAINER:-pc-control-server}"

./scripts/preflight.sh || { echo; echo "preflight failed, fix above first"; exit 1; }
echo
since=$(date -u +%Y-%m-%dT%H:%M:%SZ)
node scripts/fake-phone.js "$@"
rc=$?
echo
echo "== server log since test start"
docker logs --since "$since" "$CONTAINER" 2>&1 | grep -v 'Health Check' | sed 's/^/  /'
echo
bad=$(docker logs --since "$since" "$CONTAINER" 2>&1 | grep -i 'command failed' | grep -vi 'unsupported key' | wc -l)
if [ "$rc" -eq 0 ] && [ "$bad" -eq 0 ]; then echo "RESULT: OK, phone control should work"; else echo "RESULT: problems found ($bad unexpected input failures, script rc=$rc)"; exit 1; fi
