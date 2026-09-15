# CLAUDE.md

Remote control of a PC from a phone. Go server + native C input backend (`server/`), Expo/React Native client (`client/`).

## Layout

- `server/cmd/main.go` — CLI entrypoint, calls `internal/server.Run()`.
- `server/cmd/desktop/main.go` — Fyne tray app entrypoint (`--hidden` starts in the tray).
- `server/internal/server` — service core: `New(Options)`, `Start()`, `Stop(ctx)`, `Clients()`; emits `events.Event` to a handler. `Run()` is the CLI wrapper (signals, banner).
- `server/internal/events` — event kinds + nil-safe `Handler.Emit`.
- `server/internal/appconfig` — desktop settings as JSON in `os.UserConfigDir()/pc-control/config.json`; first run imports `.env`.
- `server/internal/desktop` — Fyne UI (`app.go`), server lifecycle + log ring (`controller.go`), per-OS hints, autostart via `emersion/go-autostart`. Icon embedded from `assets/icon.png`.
- `server/internal/web` — WS handler: JSON `protocol.Command` → `input.Backend` calls. Token checked per message.
- `server/internal/input` — Go `Backend` interface; `cbackend.go` is the cgo bridge (build tag `cgo && pcinput`), `cbackend_disabled.go` the fallback. `pcinput_bridge.c` `#include`s every C source so cgo compiles them in one unit.
- `server/internal/config` — env config; `dotenv.go` reads `.env` from cwd or next to the executable without overriding existing env vars.
- `server/native/pcinput/` — C library. `platform_windows.c` (SendInput), `platform_linux_uinput.c` (uinput, clipboard paste for Unicode), `platform_macos.c` (CGEvent). `backend_detect.c` picks by OS or `PCINPUT_BACKEND`.
- `server/scripts/` — `preflight.sh` (host checks), `fake-phone.js` (replays phone WS commands, Node ≥22, no deps), `keylog.py` (reads raw events from the virtual device), `install-uinput.sh`, `test-phone.sh`.
- `client/app/useRemoteControl.js` — the phone side of the protocol; `send()` adds `token`.
- `client/plugins/withAbiFilters.js` — Expo config plugin, arm64-only APK.
- `server/tools/icongen` — draws the shared icon; `make icons` regenerates the tray PNG and `client/assets/*` (app, adaptive, splash). Edit the generator, not the PNGs.
- `.github/workflows/build.yml` — builds linux/windows/macOS binaries + APK; `v*` tags publish a release.

## Protocol

WebSocket JSON: `{type, x, y, key, value, button, token}`. Types: `move`, `scroll`, `click` (button `left|right|middle`), `type_string` (value), `tap`/`key_down`/`key_up` (key `alt|backspace|command|enter|shift|space|tab`). Wrong token → logged, ignored, connection stays open. mDNS service `_remotepad._tcp`.

## Commands

All from `server/`:

```bash
make                 # binary for this OS → dist/
make linux windows   # cross-compile (windows needs x86_64-w64-mingw32-gcc)
make darwin          # only on a Mac
make desktop         # Fyne tray app; Linux needs libgl1-mesa-dev xorg-dev; windows build adds -H=windowsgui
make apk             # expo prebuild + gradle → dist/pc-control-client.apk
make preflight       # host checks; run before blaming code
make test-phone      # preflight + fake-phone + log review
go build -tags pcinput ./...   # always pass the tag; without it there is no backend
docker compose up -d --build   # Linux only; pass WAYLAND_DISPLAY/XDG_RUNTIME_DIR from the shell
```

Client: `pnpm`, not npm. Expo Go does not work (native `react-native-zeroconf`).

## Gotchas

- Never emit an event while holding a mutex that the handler may re-enter: `server.Start` and `desktop.controller.start` unlock before `Emit`, because the UI handler calls back into `Running()`/`Clients()`. Two deadlocks came from this.
- UI updates from goroutines go through `fyne.Do`; before `app.Run()` on the main goroutine it executes inline.
- Test the desktop app in isolation with `XDG_CONFIG_HOME=<tmp> WS_PORT=1515 ./dist/pc-control-desktop`; on niri use `niri msg windows` + `grim` for a screenshot.
- Linux key codes are QWERTY-ordered, not alphabetical. Never compute `KEY_A + n`; use the table in `platform_linux_uinput.c`.
- `/dev/uinput` must be group-accessible and `PC_CONTROL_INPUT_GID` in `server/.env` must equal `stat -c %g /dev/uinput`. Wrong gid → `pcinput backend is unavailable ... permission denied`, server still starts with a dead backend. `make install-uinput` fixes it.
- Firewall blocks the phone silently: no log line at all. `preflight.sh` checks ufw/firewalld.
- The `apk` Makefile target runs Gradle with `env -u MAKEFLAGS -u MAKELEVEL -u MFLAGS`: ndk-build is make and inherits our flags otherwise.
- `platform_macos.c` compiles in CI on `macos-latest`; there is no macOS SDK on the dev machine. Syntax-check locally with a stub header if needed. `PC_KEY_ALT` is Command on macOS on purpose (Alt+Tab bar → Cmd+Tab).
- `golang.org/x/net` must stay recent; the 2020 version fails to link on darwin with Go 1.24.
- `.env` values may contain spaces unquoted (`PC_NAME=My PC`). Shell scripts parse it line by line, never `source` it.
- Docker image sets `PCINPUT_BACKEND=linux-uinput`, has `wl-copy` and `xclip`.

## Conventions

- Commits: Conventional Commits (`feat:`, `fix:`, `build:`, `ci:`, `docs:`), scope in parentheses when useful. Don't commit unless asked.
- C: C99, `-Wall -Wextra -Wpedantic` clean, `pc_set_errorf` for errors, return `PCINPUT_*` codes. Each platform file wrapped in its `#ifdef`.
- Go: `gofmt`, no new dependencies without reason (the `.env` parser is hand-written for that reason).
- Docs in English; README is user-facing, keep it in sync when behavior changes.
