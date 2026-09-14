# Build the pc-control server as a single static binary per platform.
# The C input backend is compiled into the binary through cgo.
#
#   make            -> binary for the current OS in dist/
#   make linux      -> dist/pc-control-server-linux-amd64
#   make windows    -> dist/pc-control-server-windows-amd64.exe  (needs mingw-w64)
#   make darwin     -> dist/pc-control-server-darwin-arm64        (run on a Mac)
#   make all        -> linux + windows
#   make apk        -> dist/pc-control-client.apk (local Gradle build, needs Android SDK + JDK 17)
#   make apk-eas    -> same via EAS cloud build (needs `eas login`)
#   make test-phone -> run the fake-phone test against the running server

BIN     := pc-control-server
DIST    := dist
TAGS    := pcinput
LDFLAGS := -s -w
PKG     := ./cmd
SRC     := $(shell find cmd internal native -type f -name '*.go' -o -name '*.c' -o -name '*.h') go.mod go.sum

MINGW := x86_64-w64-mingw32-gcc

CLIENT      := ../client
ANDROID_DIR := $(CLIENT)/android
APK_OUT     := $(ANDROID_DIR)/app/build/outputs/apk/release/app-release.apk

.PHONY: build all linux windows darwin apk apk-eas clean clean-apk test-phone preflight

build: $(DIST)/$(BIN)

all: linux windows

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

preflight:
	./scripts/preflight.sh

test-phone:
	./scripts/test-phone.sh

clean:
	rm -rf $(DIST)
