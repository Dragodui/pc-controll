# PC Control App

A remote control application for Linux (X11) using a Go server and a React Native mobile client.

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

The server requires X11 to simulate mouse and keyboard events.

### 1. Configuration
Navigate to the `server` directory and create a `.env` file:

```bash
cd server
cp .env.example .env # Or create one manually
```

Edit `.env`:
```env
WS_PORT=1488
SERVER_PASSWORD=1234
```

### 2. Permissions (X11)
Since the server runs in Docker, you must allow it to access your display:
```bash
xhost +local:docker
```

### 3. Run with Docker (Recommended)
```bash
docker compose up -d --build
```

### 4. Run without Docker
If you have Go installed locally, install dependencies and run:
```bash
sudo apt install libx11-dev libxtst-dev libpng-dev # Debian/Ubuntu/PopOS
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
- Default Port: `1488`
- Default Password: `1234`

---

## Troubleshooting

- **"Could not open main display"**: Ensure you ran `xhost +local:docker`.
- **Connection Timed Out**: Check your PC's firewall. You might need to allow the port:
  ```bash
  sudo ufw allow 1488/tcp
  ```
- **Scrolling doesn't work**: Ensure your Linux environment uses **X11** (Wayland is currently not supported by `robotgo`).

---
