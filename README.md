# PC Control

Control your PC from your phone over Wi-Fi: trackpad, scroll, keyboard, Alt+Tab.
A Go server with a native C input backend runs on the computer; an Expo (React Native) app runs on the phone.

## Features

- **Trackpad**: move the mouse, single-finger tap for left click, two-finger tap for right click.
- **Scroll**: two-finger drag, vertical and horizontal.
- **Keyboard**: full text input including Unicode, plus Backspace, Enter, Space.
- **Alt+Tab bar**: switch windows with haptic feedback (Cmd+Tab on macOS).
- **Sensitivity**: separate sliders for mouse and scroll speed.
- **Auto-discovery**: mDNS (`_remotepad._tcp`) and network scan, or enter the IP by hand.

## Quick start

1. Download from [Releases](https://github.com/Dragodui/pc-controll/releases):
   - `pc-control-server-linux-amd64`, `pc-control-server-windows-amd64.exe`, or `pc-control-server-darwin-arm64`
   - `pc-control-client.apk` (Android, arm64)
2. Put a `.env` next to the server binary:
   ```env
   WS_PORT=1212
   SERVER_PASSWORD=1234
   PC_NAME=My PC
   ```
3. Do the one-time OS setup below, then run the binary. It prints its IP addresses.
4. Install the APK, connect the phone to the same Wi-Fi, pick the PC from the list (or add `IP:1212` manually) and enter the password.

Everything is a single static file per platform; the C backend is compiled in.

## Server

### Supported platforms

| OS | Backend | Notes |
|---|---|---|
| Windows | Win32 `SendInput` | no setup |
| Linux (Wayland and X11) | `uinput` virtual device | needs access to `/dev/uinput`; Unicode via clipboard paste |
| macOS | CGEvent | needs Accessibility permission |

The backend is picked automatically. Force one with `PCINPUT_BACKEND=windows|linux-uinput|macos|null`.

### Configuration

The server reads `.env` from the working directory or from the folder next to the executable. Variables already set in the environment take priority (that is how Docker passes them).

| Variable | Required | Meaning |
|---|---|---|
| `WS_PORT` | yes | WebSocket port, the phone connects here |
| `SERVER_PASSWORD` | yes | password the phone must send |
| `PC_NAME` | no | name shown on the phone (default `Remote PC`) |
| `PCINPUT_BACKEND` | no | force a backend |
| `PC_CONTROL_UID/GID/INPUT_GID` | Docker only | see below |

### Linux setup

`uinput` works below the display server, so Wayland and X11 both work. The server must be able to open `/dev/uinput`.

```bash
cd server
make install-uinput   # sudo: loads the module on boot, udev rule, adds you to 'input', fixes .env
```

Manual equivalent:

```bash
sudo modprobe uinput
echo uinput | sudo tee /etc/modules-load.d/uinput.conf
echo 'KERNEL=="uinput", GROUP="input", MODE="0660"' | sudo tee /etc/udev/rules.d/99-uinput.rules
sudo udevadm control --reload && sudo udevadm trigger
sudo usermod -aG input $USER   # re-login
```

Non-ASCII text (for example Cyrillic) is pasted through the clipboard with Ctrl+V, so it overwrites the clipboard and needs a helper: `wl-clipboard` on Wayland, `xclip` or `xsel` on X11. ASCII is typed as key events; the result depends on the active keyboard layout.

Not implemented on Linux: absolute pointer movement, screen capture.

### Windows setup

None. Windows Firewall asks on first start; allow it for private networks.

### macOS setup

Run the binary once. macOS shows the Accessibility prompt; allow the binary (or the terminal that runs it) in System Settings > Privacy & Security > Accessibility, then restart the server. Until then every input command fails with a permission error.

Unicode text is typed directly, no clipboard. `alt` maps to Command so the Alt+Tab bar drives the app switcher.

### Run with Docker (Linux)

```bash
cd server
cp .env.example .env
docker compose up -d --build
```

The container uses host networking (for mDNS), `/dev/uinput` from the host, and the host Wayland socket or X11 socket for clipboard paste. If defaults are wrong, set in `.env`:

```bash
PC_CONTROL_UID=$(id -u)
PC_CONTROL_GID=$(id -g)
PC_CONTROL_INPUT_GID=$(stat -c %g /dev/uinput)
```

`make install-uinput` writes `PC_CONTROL_INPUT_GID` for you. On X11 run `xhost +local:` once. If your runtime dir is not `/run/user/1000`, export `XDG_RUNTIME_DIR` and `WAYLAND_DISPLAY` before Compose.

### Build from source

Needs Go 1.24+ and a C compiler (gcc/clang, or MSVC/mingw on Windows).

```bash
cd server
make              # dist/pc-control-server for this OS
make linux        # dist/pc-control-server-linux-amd64
make windows      # dist/pc-control-server-windows-amd64.exe (cross-compile, needs mingw-w64)
make darwin       # run on a Mac
make all          # linux + windows
```

Or directly: `go build -tags pcinput ./cmd`. Without `-tags pcinput` the server builds with no input backend.

### Testing without a phone

```bash
cd server
make preflight     # host checks: container, /dev/uinput, firewall, mDNS, clipboard helper
make test-phone    # preflight + replays the phone's WebSocket commands, then checks the server log
node scripts/fake-phone.js move click type   # individual scenarios
python3 scripts/keylog.py                    # prints the raw events the virtual device emits
```

`fake-phone.js` moves the cursor, scrolls, clicks and types on the real screen; focus a text editor first.

## Client (Android / iOS)

The app uses native modules (`react-native-zeroconf`), so it does not run in Expo Go. Use the prebuilt APK from Releases, or build:

```bash
cd client
pnpm install
```

Local APK (needs Android SDK and JDK 17):

```bash
cd server && make apk    # dist/pc-control-client.apk, arm64 only
```

Cloud build via EAS (`eas login` first): `make apk-eas`. Development client: `pnpm dev` after `npx expo run:android`.

The APK ships only `arm64-v8a`. For an x86 emulator add the ABI to `plugins` in `client/app.json`.

## Releases

GitHub Actions builds Linux, Windows and macOS binaries plus the APK on every push. A tag publishes a release:

```bash
git tag v1.0.0 && git push origin v1.0.0
```

Binaries are not code-signed. Windows SmartScreen: "More info" > "Run anyway". macOS Gatekeeper: `xattr -d com.apple.quarantine pc-control-server-darwin-arm64`.

## Troubleshooting

- **Phone cannot find or connect to the PC**: same Wi-Fi? Firewall on the PC is the usual cause. `make preflight` checks it. ufw example:
  ```bash
  sudo ufw allow from 192.168.0.0/24 to any port 1212 proto tcp
  sudo ufw allow from 192.168.0.0/24 to any port 5353 proto udp   # mDNS
  ```
  Router "AP isolation" / "client isolation" also blocks it.
- **Server starts but nothing moves (Linux)**: `pcinput backend is unavailable ... permission denied` in the log means `/dev/uinput` is not accessible. Run `make install-uinput`, re-login (native) or recreate the container (Docker).
- **Letters come out wrong (Linux)**: the PC keyboard layout is not Latin at the moment of typing. Switch layout on the PC.
- **Cyrillic does not appear (Linux)**: clipboard helper missing, or the focused app does not paste with Ctrl+V (terminals use Ctrl+Shift+V).
- **macOS: every command fails**: Accessibility permission not granted, see macOS setup.
- **`SERVER_PASSWORD is required`**: no `.env` next to the binary and no environment variables.
