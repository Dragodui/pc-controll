# Build the pc-control server as a single static binary per platform.
# The C input backend is compiled into the binary through cgo.
#
#   make            -> binary for the current OS in dist/
#   make linux      -> dist/pc-control-server-linux-amd64
#   make windows    -> dist/pc-control-server-windows-amd64.exe  (needs mingw-w64)
#   make darwin     -> dist/pc-control-server-darwin-arm64        (run on a Mac)
#   make all        -> linux + windows
#   make desktop    -> dist/pc-control-desktop (tray app) for the current OS
#   make desktop-linux | desktop-windows | desktop-darwin
#   make apk        -> dist/pc-control-client.apk (local Gradle build, needs Android SDK + JDK 17)
#   make apk-eas    -> same via EAS cloud build (needs `eas login`)
#   make test-phone -> run the fake-phone test against the running server
#   make install-uinput -> Linux host setup for /dev/uinput (sudo)

BIN     := pc-control-server
DBIN    := pc-control-desktop
DPKG    := ./cmd/desktop
DIST    := dist
TAGS    := pcinput
LDFLAGS := -s -w
PKG     := ./cmd
SRC     := $(shell find cmd internal native -type f -name '*.go' -o -name '*.c' -o -name '*.h') go.mod go.sum

MINGW := x86_64-w64-mingw32-gcc

CLIENT      := ../client
ANDROID_DIR := $(CLIENT)/android
APK_OUT     := $(ANDROID_DIR)/app/build/outputs/apk/release/app-release.apk

.PHONY: build all linux windows darwin desktop desktop-linux desktop-windows desktop-darwin apk apk-eas icons clean clean-apk test-phone preflight install-uinput

build: $(DIST)/$(BIN)

all: linux windows desktop-linux desktop-windows

linux:   $(DIST)/$(BIN)-linux-amd64
windows: $(DIST)/$(BIN)-windows-amd64.exe
darwin:  $(DIST)/$(BIN)-darwin-arm64

$(DIST):
	mkdir -p $(DIST)

$(DIST)/$(BIN): $(SRC) | $(DIST)
	CGO_ENABLED=1 go build -tags $(TAGS) -ldflags="$(LDFLAGS)" -o $@ $(PKG)

$(DIST)/$(BIN)-linux-amd64: $(SRC) | $(DIST)
	CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -tags $(TAGS) -ldflags="$(LDFLAGS)" -o $@ $(PKG)

$(DIST)/$(BIN)-windows-amd64.exe: $(SRC) | $(DIST)
	@command -v $(MINGW) >/dev/null || { echo "missing $(MINGW): install mingw-w64-gcc"; exit 1; }
	CGO_ENABLED=1 GOOS=windows GOARCH=amd64 CC=$(MINGW) go build -tags $(TAGS) -ldflags="$(LDFLAGS)" -o $@ $(PKG)

# Cross-compiling to macOS needs osxcross; simplest is to run this target on a Mac.
$(DIST)/$(BIN)-darwin-arm64: $(SRC) | $(DIST)
	CGO_ENABLED=1 GOOS=darwin GOARCH=arm64 go build -tags $(TAGS) -ldflags="$(LDFLAGS)" -o $@ $(PKG)

# --- Desktop (Fyne tray app) ---------------------------------------------
# Linux build needs GL/X11 headers: mesa + libx11/libxcursor/libxrandr/libxinerama/libxi (Debian: libgl1-mesa-dev xorg-dev).

desktop:         $(DIST)/$(DBIN)
desktop-linux:   $(DIST)/$(DBIN)-linux-amd64
desktop-windows: $(DIST)/$(DBIN)-windows-amd64.exe
desktop-darwin:  $(DIST)/$(DBIN)-darwin-arm64

$(DIST)/$(DBIN): $(SRC) | $(DIST)
	CGO_ENABLED=1 go build -tags $(TAGS) -ldflags="$(LDFLAGS)" -o $@ $(DPKG)

$(DIST)/$(DBIN)-linux-amd64: $(SRC) | $(DIST)
	CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -tags $(TAGS) -ldflags="$(LDFLAGS)" -o $@ $(DPKG)

# -H=windowsgui: no console window behind the tray app.
$(DIST)/$(DBIN)-windows-amd64.exe: $(SRC) | $(DIST)
	@command -v $(MINGW) >/dev/null || { echo "missing $(MINGW): install mingw-w64-gcc"; exit 1; }
	CGO_ENABLED=1 GOOS=windows GOARCH=amd64 CC=$(MINGW) go build -tags $(TAGS) -ldflags="$(LDFLAGS) -H=windowsgui" -o $@ $(DPKG)

$(DIST)/$(DBIN)-darwin-arm64: $(SRC) | $(DIST)
	CGO_ENABLED=1 GOOS=darwin GOARCH=arm64 go build -tags $(TAGS) -ldflags="$(LDFLAGS)" -o $@ $(DPKG)

# --- Android client -------------------------------------------------------
# expo prebuild generates $(ANDROID_DIR) (gitignored), then Gradle builds a
# release APK signed with the debug keystore: fine for sideloading, not for Play.

apk: $(DIST)/pc-control-client.apk

$(CLIENT)/node_modules: $(CLIENT)/package.json $(CLIENT)/pnpm-lock.yaml
	cd $(CLIENT) && pnpm install --frozen-lockfile
	touch $@

$(ANDROID_DIR)/gradlew: $(CLIENT)/node_modules $(CLIENT)/app.json
	cd $(CLIENT) && CI=1 npx expo prebuild --platform android --no-install

$(DIST)/pc-control-client.apk: $(ANDROID_DIR)/gradlew $(shell find $(CLIENT)/app $(CLIENT)/App.jsx $(CLIENT)/index.js -type f 2>/dev/null) | $(DIST)
	# unset make vars: ndk-build (a make) inside Gradle inherits them and breaks
	cd $(ANDROID_DIR) && env -u MAKEFLAGS -u MAKELEVEL -u MFLAGS ./gradlew assembleRelease --no-daemon -q
	cp $(APK_OUT) $@
	@echo "APK: $@"

apk-eas:
	cd $(CLIENT) && npx eas build -p android --profile preview

clean-apk:
	rm -rf $(ANDROID_DIR) $(DIST)/pc-control-client.apk

# Regenerate the shared icon for the tray app and the Android app from tools/icongen.
icons:
	go run ./tools/icongen internal/desktop/assets/icon.png 256 tile
	go run ./tools/icongen $(CLIENT)/assets/icon.png 1024 tile
	go run ./tools/icongen $(CLIENT)/assets/adaptive-icon.png 1024 foreground
	go run ./tools/icongen $(CLIENT)/assets/splash-icon.png 512 foreground

# One-time Linux host setup (module autoload, udev rule, group, .env gid). Needs sudo.
install-uinput:
	sudo ./scripts/install-uinput.sh $(USER)

preflight:
	./scripts/preflight.sh

test-phone:
	./scripts/test-phone.sh

clean:
	rm -rf $(DIST)
