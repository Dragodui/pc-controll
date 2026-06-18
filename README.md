# PC Control App

A remote control application using a Go server, a native input backend, and a React Native mobile client.

## Features

- **Trackpad**: Move mouse, single-finger tap for left click.
- **Scroll**: Two-finger drag for vertical and horizontal scrolling.
- **Right Click**: Two-finger tap.
- **Keyboard**: Full text input and special keys (Backspace, Enter).
- **Alt+Tab**: Dedicated bar to switch windows easily with haptic feedback.
- **Sensitivity**: Independent sliders for mouse and scroll speed.
- **Auto-Discovery**: mDNS support and network scanning to find your PC.

---

## Server Setup

The server now selects the input backend automatically:

- `Windows`: uses the native `pcinput` C backend when built with `-tags pcinput`.
- `Wayland` on Linux: uses the native `pcinput` Linux `uinput` virtual input backend when built with `-tags pcinput`.
- `X11` on Linux: native backend is planned, but not implemented yet.

### 1. Configuration
Navigate to the `server` directory and create a `.env` file:

```bash
cd server
cp .env.example .env # Or create one manually
```

Edit `.env`:
```env
WS_PORT=1212
SERVER_PASSWORD=1234
```

### 2. Choose the backend requirements

#### Linux uinput
The native Linux backend uses `/dev/uinput`. Your user or container must be allowed to open that device.

```bash
sudo modprobe uinput
```

For non-ASCII text such as Cyrillic, install a clipboard helper. Wayland usually uses `wl-copy`:

```bash
sudo apt install wl-clipboard
```

X11-like sessions can use `xclip` or `xsel`:

```bash
sudo apt install xclip
```

Notes:
- The native `uinput` backend supports relative pointer movement, click, scroll, special keys, and basic ASCII text input directly.
- Unicode text input on Linux uses clipboard paste plus `Ctrl+V`, so it temporarily replaces the current clipboard.
- This is a Linux virtual input backend, not a Wayland protocol backend. It depends on compositor/device handling for virtual input devices.
- Absolute pointer movement and screen capture are not implemented for Wayland yet.

#### Windows native backend
Build and run with the `pcinput` tag:

```bash
cd server
go run -tags pcinput cmd/main.go
```

You can force it explicitly with `PCINPUT_BACKEND=windows`.

#### X11
X11 support should be implemented in `server/native/pcinput` as a native backend.

### 3. Run with Docker
```bash
docker compose up -d --build
```

The Docker setup forces `PCINPUT_BACKEND=linux-uinput` and needs `/dev/uinput` from the host. Unicode paste in Docker also needs the host Wayland socket. If your runtime dir is not `/run/user/1000`, export `XDG_RUNTIME_DIR` before running Compose.

For Docker on Linux desktop, set these in `server/.env` if defaults are wrong:

```bash
PC_CONTROL_UID=$(id -u)
PC_CONTROL_GID=$(id -g)
PC_CONTROL_INPUT_GID=$(stat -c %g /dev/uinput)
```

### 4. Run without Docker
Windows:

```bash
cd server
go run -tags pcinput cmd/main.go
```

Linux Wayland:

```bash
cd server
go mod download
go run -tags pcinput cmd/main.go
```

---

## Client Setup (Mobile)

The client is built with Expo (React Native).

### 1. Install Dependencies
```bash
cd client
npm install
```

### 2. Start Expo
```bash
npx expo start
```
Scan the QR code with the **Expo Go** app on your Android or iOS device.

### 3. Connecting
- Ensure your phone and PC are on the **same Wi-Fi network**.
- Use the **Search** icon in the app to scan the network, or tap the **+** button to add your PC's IP manually.
- Default Port: `1212`
- Default Password: `1234`

---

## Troubleshooting

- **Connection Timed Out**: Check your PC's firewall. You might need to allow the port:
  ```bash
  sudo ufw allow 1212/tcp
  ```
- **Windows input does not use pcinput**: Build with `go run -tags pcinput cmd/main.go` or `go build -tags pcinput ./...`.
- **Wayland input does not work**: Check that `/dev/uinput` exists and the server has permission to open it.
- **Need to force a backend**: set `PCINPUT_BACKEND=windows`, `PCINPUT_BACKEND=linux-uinput`, or `PCINPUT_BACKEND=wayland`.

---
