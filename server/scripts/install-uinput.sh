#!/usr/bin/env bash
# One-time Linux host setup for the uinput backend:
#   - load the uinput kernel module now and on every boot
#   - let the 'input' group open /dev/uinput
#   - add the current user to 'input'
#   - point PC_CONTROL_INPUT_GID in .env at the input group (Docker)
# Usage: sudo ./scripts/install-uinput.sh [username]
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "$(id -u)" -ne 0 ]; then
  echo "run with sudo: sudo $0 ${1:-}" >&2
  exit 1
fi

target_user="${1:-${SUDO_USER:-}}"
if [ -z "$target_user" ]; then
  echo "cannot determine target user; pass it as argument" >&2
  exit 1
fi

echo "== kernel module"
modprobe uinput
echo uinput > /etc/modules-load.d/uinput.conf
echo "  loaded now, persisted in /etc/modules-load.d/uinput.conf"

echo "== udev rule"
getent group input >/dev/null || groupadd --system input
cat > /etc/udev/rules.d/99-uinput.rules <<'RULE'
KERNEL=="uinput", GROUP="input", MODE="0660"
RULE
udevadm control --reload
udevadm trigger --name-match=uinput
echo "  /etc/udev/rules.d/99-uinput.rules: $(stat -c '%U:%G %a' /dev/uinput)"

echo "== group membership"
if id -nG "$target_user" | tr ' ' '\n' | grep -qx input; then
  echo "  $target_user already in input"
else
  usermod -aG input "$target_user"
  echo "  added $target_user to input (re-login for the native binary; Docker works immediately)"
fi

echo "== .env"
input_gid=$(getent group input | cut -d: -f3)
if [ -f .env ]; then
  if grep -q '^PC_CONTROL_INPUT_GID=' .env; then
    sed -i "s/^PC_CONTROL_INPUT_GID=.*/PC_CONTROL_INPUT_GID=$input_gid/" .env
  else
    echo "PC_CONTROL_INPUT_GID=$input_gid" >> .env
  fi
  chown "$target_user" .env
  echo "  PC_CONTROL_INPUT_GID=$input_gid"
else
  echo "  no .env yet; set PC_CONTROL_INPUT_GID=$input_gid when you create it"
fi

echo
echo "done. Docker: docker compose up -d --force-recreate. Native: re-login, then run the binary."
