# PC Control App

A remote control application for Linux using a Go server and a React Native mobile client.

## Features

- **Trackpad**: Move mouse, single-finger tap for left click.
- **Scroll**: Two-finger drag for vertical and horizontal scrolling.
- **Right Click**: Two-finger tap.
- **Keyboard**: Full text input and special keys (Backspace, Enter).
- **Alt+Tab**: Dedicated bar to switch windows easily with haptic feedback.
- **Sensitivity**: Independent sliders for mouse and scroll speed.
- **Auto-Discovery**: mDNS support and network scanning to find your PC.

---

## Server Setup (Linux)

The server now selects the input backend automatically:

- `Wayland` on Linux: uses CLI tools.
- `X11` on Linux: uses `robotgo`.
- Other systems: keeps using `robotgo`.

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

#### Wayland
Install the CLI tools used by the server:

```bash
sudo apt install ydotool wtype
```

Fedora/RHEL:

```bash
sudo dnf install ydotool wtype
```

Optional but recommended for pointer scrolling on Wayland:

```bash
sudo apt install wlrctl
```

Fedora/RHEL:

```bash
sudo dnf install wlrctl
```

Notes:
- `ydotoold` must be running, because `ydotool` depends on it.
- If `wlrctl` is missing, move and click still work through `ydotool`, but scroll on Wayland will be unavailable.

#### X11
If you run under X11, `robotgo` is used as before.

### 3. Permissions (X11 only)
If you run the X11 path in Docker, you must allow it to access your display:
```bash
xhost +local:docker
```

### 4. Run with Docker
```bash
docker compose up -d --build
```

Docker is still primarily suitable for the X11 path. For Wayland, running the server directly on the host is the safer option because the CLI tools need access to your real user session and input devices.

### 5. Run without Docker
If you have Go installed locally, install dependencies and run:
```bash
sudo apt install libx11-dev libxtst-dev libpng-dev # Debian/Ubuntu/PopOS
go mod download
go run cmd/main.go
```

Fedora/RHEL:

```bash
sudo dnf install libX11-devel libXtst-devel libpng-devel gcc
go mod download
go run cmd/main.go
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

- **"Could not open main display"**: Ensure you ran `xhost +local:docker` and that you are actually on X11.
- **Connection Timed Out**: Check your PC's firewall. You might need to allow the port:
  ```bash
  sudo ufw allow 1212/tcp
  ```
- **Wayland input does not work**: Check that `ydotool` is installed and `ydotoold` is running in the same user session.
- **Wayland scrolling does not work**: Install `wlrctl`.
- **Need to force a backend**: set `INPUT_BACKEND=robotgo` or `INPUT_BACKEND=wayland-cli`.

---
