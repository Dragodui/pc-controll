#!/usr/bin/env bash
# Host-side checks: is the Docker server reachable and able to inject input?
# Usage: ./scripts/preflight.sh
set -u
cd "$(dirname "$0")/.."

# .env may have unquoted values with spaces (PC_NAME=My PC), so parse by hand.
if [ -f .env ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ''|'#'*) continue;; esac
    key="${line%%=*}"; val="${line#*=}"
    export "$key=$val"
  done < .env
fi
WS_PORT="${WS_PORT:-1212}"
PC_NAME="${PC_NAME:-Remote PC}"
CONTAINER="${CONTAINER:-pc-control-server}"

pass=0; fail=0
ok()   { echo "  [OK]   $*"; pass=$((pass+1)); }
bad()  { echo "  [FAIL] $*"; fail=$((fail+1)); }
warn() { echo "  [WARN] $*"; }

echo "== Container"
state=$(docker inspect -f '{{.State.Status}}' "$CONTAINER" 2>/dev/null || true)
if [ "$state" = "running" ]; then ok "$CONTAINER running"; else bad "$CONTAINER not running (state: ${state:-missing}). Run: docker compose up -d --build"; fi

if [ "$state" = "running" ]; then
  if docker logs "$CONTAINER" 2>&1 | grep -q 'Input backend selected: pcinput'; then
    ok "backend: pcinput initialized"
  elif docker logs "$CONTAINER" 2>&1 | grep -q 'pcinput backend is unavailable'; then
    bad "$(docker logs "$CONTAINER" 2>&1 | grep -m1 'pcinput backend is unavailable')"
  else
    bad "no backend line in logs (image built without -tags pcinput?)"
  fi
  if docker logs "$CONTAINER" 2>&1 | grep -q 'mDNS: Service registered'; then ok "mDNS registered as '$PC_NAME'"; else bad "mDNS not registered (see docker logs)"; fi
  if docker logs "$CONTAINER" 2>&1 | grep -qi 'input command failed\|permission denied\|backend is unavailable'; then
    warn "server log has input errors:"; docker logs "$CONTAINER" 2>&1 | grep -i 'input command failed\|permission denied\|backend is unavailable' | tail -5 | sed 's/^/         /'
  fi
fi

echo "== /dev/uinput"
if [ -c /dev/uinput ]; then
  gid=$(stat -c %g /dev/uinput); mode=$(stat -c %a /dev/uinput)
  ok "device exists (gid=$gid mode=$mode)"
  want="${PC_CONTROL_INPUT_GID:-104}"
  if [ "$gid" = "$want" ]; then ok "PC_CONTROL_INPUT_GID=$want matches device gid"; else bad "PC_CONTROL_INPUT_GID=$want but /dev/uinput gid=$gid. Set PC_CONTROL_INPUT_GID=$gid in .env and recreate container."; fi
  case "$mode" in 66*|67*|64*|76*) ok "group can open device (mode $mode)";; *) bad "mode $mode: group has no rw. Run: sudo chmod 660 /dev/uinput";; esac
else
  bad "/dev/uinput missing. Run: sudo modprobe uinput"
fi
if grep -q "pcinput virtual input" /proc/bus/input/devices; then ok "virtual device 'pcinput virtual input' registered in kernel"; else bad "no 'pcinput virtual input' in /proc/bus/input/devices: container did not create uinput device"; fi

echo "== Network"
if ss -ltn | grep -q ":$WS_PORT "; then ok "port $WS_PORT listening on host (network_mode: host)"; else bad "nothing listening on :$WS_PORT"; fi
lan_ip=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}' | head -1)
[ -n "$lan_ip" ] && ok "LAN IP: $lan_ip  (phone should reach ws://$lan_ip:$WS_PORT/ws)" || warn "cannot determine LAN IP"
if [ -n "$lan_ip" ] && curl -fs -m 3 "http://$lan_ip:$WS_PORT/health" >/dev/null; then ok "GET http://$lan_ip:$WS_PORT/health -> OK"; else bad "health endpoint unreachable on LAN IP"; fi
if command -v avahi-browse >/dev/null; then
  if timeout 4 avahi-browse -rtp _remotepad._tcp 2>/dev/null | grep -q "^=.*$(printf '%s' "$PC_NAME" | sed 's/ /\\\\032/g')"; then ok "mDNS _remotepad._tcp resolves '$PC_NAME' (auto-discovery works)"; else warn "avahi-browse did not see '$PC_NAME'. Phone may need manual IP entry. (Avahi and Go zeroconf may conflict on host.)"; fi
else
  warn "avahi-browse missing, mDNS not verified"
fi
if systemctl is-active --quiet ufw 2>/dev/null; then
  if sudo -n ufw status 2>/dev/null | grep -q "$WS_PORT"; then ok "ufw allows port $WS_PORT"
  else warn "ufw active. Phone will not connect unless allowed: sudo ufw allow from 192.168.0.0/24 to any port $WS_PORT proto tcp; sudo ufw allow from 192.168.0.0/24 to any port 5353 proto udp"; fi
fi
if command -v firewall-cmd >/dev/null && firewall-cmd --state >/dev/null 2>&1; then
  firewall-cmd --list-ports 2>/dev/null | grep -q "$WS_PORT/tcp" || warn "firewalld active, port $WS_PORT/tcp not opened"
fi
if command -v nft >/dev/null && sudo -n nft list ruleset >/dev/null 2>&1; then
  sudo -n nft list ruleset | grep -q "drop" && warn "nftables has drop rules; verify $WS_PORT/tcp allowed from LAN"
fi

echo "== Wayland clipboard (Unicode typing)"
sock="${XDG_RUNTIME_DIR:-/run/user/1000}/${WAYLAND_DISPLAY:-wayland-0}"
[ -S "$sock" ] && ok "wayland socket $sock" || bad "wayland socket $sock missing. Compose mounts \${XDG_RUNTIME_DIR}/\${WAYLAND_DISPLAY}; export WAYLAND_DISPLAY=$WAYLAND_DISPLAY before compose up"
if [ "$state" = "running" ]; then
  docker exec "$CONTAINER" sh -c 'command -v wl-copy' >/dev/null 2>&1 && ok "wl-copy inside container" || warn "wl-copy missing in container; non-ASCII text will fail"
fi

echo
echo "passed=$pass failed=$fail"
[ "$fail" -eq 0 ] && echo "Next: node scripts/fake-phone.js" 
exit $fail
