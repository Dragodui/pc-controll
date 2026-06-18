# Universal Input Backend Plan

## Goal

Make the project more universal by moving low-level input automation into a small C library with platform-specific backends, while keeping the Go server API simple and stable.

The Go code should continue to expose high-level methods such as:

```go
Move(dx, dy int) error
Scroll(dx, dy int) error
Click(button string) error
TypeString(value string) error
Tap(key string) error
KeyDown(key string) error
KeyUp(key string) error
```

The C layer should own OS-specific implementation details:

- Windows: Win32 input APIs.
- macOS: Quartz/CoreGraphics input APIs.
- Linux X11: Xlib/XTest or compatible implementation.
- Linux Wayland: capability-based backend using supported protocols/tools/libraries where possible.

This replaces the old direct split between native Go/third-party automation and shell-command input over time, without breaking the existing WebSocket protocol or mobile client commands.

## Current Project State

The server already has a useful abstraction:

- `server/internal/input/backend.go` defines the Go `Backend` interface.
- `server/internal/input/detect.go` selects a backend.
- The old Go-side Wayland CLI backend has been removed; Linux input now belongs in `pcinput`.
- `server/internal/web/server.go` maps WebSocket protocol commands to backend calls.

This means the migration can be incremental. The first target is not to rewrite the whole app, but to add a new backend implementation behind the existing Go interface.

## Design Principles

1. Keep the public Go server behavior stable.
2. Do not expose platform details to the mobile client.
3. Make platform support explicit through capabilities.
4. Treat Wayland as partially available by design, not as a normal X11 replacement.
5. Keep the C ABI small and stable.
6. Avoid making Go depend on large platform-specific packages directly.
7. Prefer native APIs over shelling out to CLI tools where practical.
8. Allow graceful fallback to the existing backend during migration.

## Important Wayland Reality

Wayland intentionally restricts global input simulation and screen capture. A fully universal `move/click/type/screenshot` backend cannot be guaranteed on every Wayland compositor.

Expected Wayland limitations:

- Pointer movement may require compositor support, portals, `libei`, or virtual input devices.
- Keyboard input may require compositor support or a virtual input path.
- Screenshot/screen capture usually requires portals and user permission.
- Some operations may work on wlroots compositors but not GNOME/KDE, or the reverse.
- Headless/server/Docker usage is especially constrained.

Therefore, the library must expose capabilities instead of pretending every method always works.

Example capability model:

```c
typedef struct pc_caps {
    int mouse_move_relative;
    int mouse_move_absolute;
    int mouse_click;
    int mouse_scroll;
    int keyboard_text;
    int keyboard_keys;
    int screen_capture;
    int requires_user_permission;
    int degraded;
} pc_caps_t;
```

The Go layer should use this for diagnostics, health responses, startup logs, and future client UI feedback.

## Proposed Repository Layout

Add a native library folder under the server:

```text
server/
  native/
    pcinput/
      include/
        pcinput.h
      src/
        pcinput.c
        pcinput_internal.h
        backend_null.c
        backend_detect.c
        platform_windows.c
        platform_macos.c
        platform_linux_x11.c
        platform_linux_wayland.c
        keymap.c
        error.c
      CMakeLists.txt
      README.md
  internal/
    input/
      cbackend.go
      cbackend_disabled.go
      backend.go
      detect.go
      wayland.go
```

Keep `wayland.go` initially as a Linux Wayland fallback path until native Wayland support is available.

## C Library Public API

The C API should be stable, C89/C99-compatible where reasonable, and avoid exposing platform-specific structs.

Initial header:

```c
#ifndef PCINPUT_H
#define PCINPUT_H

#ifdef __cplusplus
extern "C" {
#endif

#define PCINPUT_OK 0
#define PCINPUT_ERR_UNSUPPORTED 1
#define PCINPUT_ERR_PERMISSION 2
#define PCINPUT_ERR_BACKEND 3
#define PCINPUT_ERR_INVALID_ARGUMENT 4
#define PCINPUT_ERR_NOT_INITIALIZED 5

typedef enum pc_mouse_button {
    PC_MOUSE_LEFT = 1,
    PC_MOUSE_RIGHT = 2,
    PC_MOUSE_MIDDLE = 3
} pc_mouse_button_t;

typedef enum pc_key {
    PC_KEY_UNKNOWN = 0,
    PC_KEY_ALT,
    PC_KEY_BACKSPACE,
    PC_KEY_COMMAND,
    PC_KEY_ENTER,
    PC_KEY_SHIFT,
    PC_KEY_SPACE,
    PC_KEY_TAB
} pc_key_t;

typedef struct pc_caps {
    int mouse_move_relative;
    int mouse_move_absolute;
    int mouse_click;
    int mouse_scroll;
    int keyboard_text;
    int keyboard_keys;
    int screen_capture;
    int requires_user_permission;
    int degraded;
} pc_caps_t;

int pc_init(void);
void pc_shutdown(void);

const char* pc_backend_name(void);
int pc_get_capabilities(pc_caps_t* out);
const char* pc_last_error(void);

int pc_mouse_move_relative(int dx, int dy);
int pc_mouse_move_absolute(int x, int y);
int pc_mouse_click(pc_mouse_button_t button);
int pc_mouse_scroll(int dx, int dy);

int pc_keyboard_type_utf8(const char* text);
int pc_keyboard_tap(pc_key_t key);
int pc_keyboard_down(pc_key_t key);
int pc_keyboard_up(pc_key_t key);

#ifdef __cplusplus
}
#endif

#endif
```

Do not add screenshot support in the first implementation unless input is already stable. Keep the capability slot so the ABI direction is clear.

## Internal C Backend Interface

Inside the C library, use a backend vtable:

```c
typedef struct pc_backend {
    const char* name;
    int (*init)(void);
    void (*shutdown)(void);
    int (*get_capabilities)(pc_caps_t* out);
    int (*mouse_move_relative)(int dx, int dy);
    int (*mouse_move_absolute)(int x, int y);
    int (*mouse_click)(pc_mouse_button_t button);
    int (*mouse_scroll)(int dx, int dy);
    int (*keyboard_type_utf8)(const char* text);
    int (*keyboard_tap)(pc_key_t key);
    int (*keyboard_down)(pc_key_t key);
    int (*keyboard_up)(pc_key_t key);
} pc_backend_t;
```

`pc_init()` should detect and select the best available backend for the current platform.

## Backend Selection Rules

Environment override:

```text
PCINPUT_BACKEND=auto
PCINPUT_BACKEND=windows
PCINPUT_BACKEND=macos
PCINPUT_BACKEND=wayland
PCINPUT_BACKEND=linux-uinput
PCINPUT_BACKEND=null
```

Go can map existing `INPUT_BACKEND` values during transition:

```text
INPUT_BACKEND=c
INPUT_BACKEND=c-auto
INPUT_BACKEND=c-wayland
INPUT_BACKEND=c-linux-uinput
```

Detection order:

1. If explicit backend is set, try it and fail clearly if unavailable.
2. Windows: use Windows backend.
3. macOS: use macOS backend.
4. Linux:
   - If `XDG_SESSION_TYPE=wayland` or `WAYLAND_DISPLAY` exists, prefer Wayland backend.
   - If `DISPLAY` exists, use X11 backend.
   - Otherwise use null backend with clear unsupported errors.

During migration, if the C backend fails to initialize, Go may fall back to the current `DetectBackend()` behavior unless explicitly forced.

## Platform Backend Details

### Windows Backend

Target APIs:

- `SendInput` for keyboard and mouse.
- `SetCursorPos` for absolute movement.
- `GetCursorPos` if relative movement needs current position.

Expected support:

- Relative move: yes.
- Absolute move: yes.
- Click: yes.
- Scroll: yes.
- Keyboard keys: yes.
- UTF-8 text: possible through Unicode `KEYEVENTF_UNICODE`.
- Screen capture: later phase.

Risks:

- UAC/elevated windows may reject input from a lower-privilege process.
- Some games or secure desktops may ignore injected input.

### macOS Backend

Target APIs:

- `CGEventCreateMouseEvent`.
- `CGEventPost`.
- `CGEventCreateKeyboardEvent`.
- `CGEventKeyboardSetUnicodeString`.

Expected support:

- Relative move: yes, via current cursor position plus delta.
- Absolute move: yes.
- Click: yes.
- Scroll: yes.
- Keyboard keys: yes.
- UTF-8 text: possible.
- Screen capture: later phase.

Risks:

- Requires Accessibility permission for input automation.
- Screen capture later requires Screen Recording permission.
- CI testing is limited without a real macOS session.

### Linux X11 Backend

Target APIs:

- `XOpenDisplay`.
- `XTestFakeMotionEvent`.
- `XTestFakeButtonEvent`.
- `XTestFakeKeyEvent`.
- `XFlush`.

Expected support:

- Relative move: yes, using current pointer position plus delta.
- Absolute move: yes.
- Click: yes.
- Scroll: yes, via buttons 4/5 and optionally 6/7.
- Keyboard keys: yes.
- UTF-8 text: possible but needs key symbol mapping; start with current special keys first.
- Screen capture: later phase.

Dependencies:

- `libX11`.
- `libXtst`.

Risks:

- Keyboard text input can be messy across layouts.
- Docker needs display socket and X permissions.

### Linux Wayland Backend

Wayland should be split into capability-based sub-backends. Do not hardcode one mechanism as "the" Wayland solution.

Potential approaches:

1. `libei`
   - Best long-term direction for input emulation.
   - Requires compositor support.
   - Not universally available.

2. `uinput`
   - Creates a virtual input device.
   - Can work across Wayland compositors for physical-like events.
   - Requires permissions, group access, or helper service.
   - Does not solve all pointer coordinate semantics cleanly.

3. `xdg-desktop-portal`
   - Useful for remote desktop and screen capture flows.
   - Often requires user consent.
   - API is D-Bus based and session-oriented.

Recommended Wayland plan:

- Phase 1: implement a native Linux `uinput` sub-backend for click, key, scroll, and relative movement where permissions allow.
- Phase 3: research and add `libei` backend when compositor support is acceptable.
- Phase 4: add portal-based remote-desktop/screen-capture path if the app needs screen features.

Expected first native Wayland capability result:

```text
mouse_move_relative: maybe
mouse_move_absolute: no
mouse_click: maybe
mouse_scroll: maybe
keyboard_text: maybe
keyboard_keys: maybe
screen_capture: no
requires_user_permission: yes
degraded: yes
```

## Go Integration

Add a new backend:

```text
server/internal/input/cbackend.go
```

It should implement the existing `Backend` interface:

```go
type CBackend struct{}

func (b CBackend) Name() string
func (b CBackend) Move(dx, dy int) error
func (b CBackend) Scroll(dx, dy int) error
func (b CBackend) Click(button string) error
func (b CBackend) TypeString(value string) error
func (b CBackend) Tap(key string) error
func (b CBackend) KeyDown(key string) error
func (b CBackend) KeyUp(key string) error
```

Use cgo build tags:

```go
//go:build cgo && pcinput
```

Provide a disabled stub:

```text
server/internal/input/cbackend_disabled.go
```

```go
//go:build !cgo || !pcinput
```

This keeps normal builds working even before native dependencies are installed.

Detection changes:

- Add `INPUT_BACKEND=c` and `INPUT_BACKEND=c-auto`.
- Add `INPUT_BACKEND=c-wayland`, `c-linux-uinput`, `c-windows`, `c-macos` as optional explicit modes.
- Default can stay current at first, then switch to C backend once stable.

Suggested migration default:

1. First release: C backend opt-in.
2. Second release: C backend default on Windows/macOS/X11 as those native backends become available.
3. Later release: add `libei` or portal integrations if native Wayland support needs compositor/session awareness.

## Go-to-C Mapping

Button mapping:

```text
"left"   -> PC_MOUSE_LEFT
"right"  -> PC_MOUSE_RIGHT
"middle" -> PC_MOUSE_MIDDLE
```

Key mapping:

```text
"alt"       -> PC_KEY_ALT
"backspace" -> PC_KEY_BACKSPACE
"command"   -> PC_KEY_COMMAND
"enter"     -> PC_KEY_ENTER
"shift"     -> PC_KEY_SHIFT
"space"     -> PC_KEY_SPACE
"tab"       -> PC_KEY_TAB
```

Error mapping:

```text
PCINPUT_ERR_UNSUPPORTED       -> unsupported feature error
PCINPUT_ERR_PERMISSION        -> permission error with setup hint
PCINPUT_ERR_BACKEND           -> backend failure
PCINPUT_ERR_INVALID_ARGUMENT  -> validation error
PCINPUT_ERR_NOT_INITIALIZED   -> initialization bug/config error
```

## Build System

Use CMake for the native library because it is portable across Windows, macOS, and Linux.

Initial build commands:

```bash
cd server/native/pcinput
cmake -S . -B build
cmake --build build
```

Go build modes:

```bash
cd server
go build ./...
go build -tags pcinput ./...
```

The CMake output should produce either:

- Static library: `libpcinput.a` / `pcinput.lib`.
- Shared library: `libpcinput.so` / `pcinput.dll` / `libpcinput.dylib`.

Prefer static linking for server distribution when possible.

## Packaging

Short term:

- Build native library manually before `go build -tags pcinput`.
- Document required packages per OS.

Medium term:

- Add scripts:
  - `server/scripts/build-native.ps1`
  - `server/scripts/build-native.sh`
  - `server/scripts/build-server.ps1`
  - `server/scripts/build-server.sh`

Long term:

- Add CI matrix:
  - Windows build.
  - macOS build.
  - Linux X11 build.
  - Linux Wayland compile-only build.

## Testing Plan

### C Unit Tests

Add tests for:

- Backend selection.
- Error handling.
- Capability reporting.
- Key mapping.
- Button mapping.
- Null backend behavior.

These tests should not require a real desktop session.

### Go Unit Tests

Add tests for:

- WebSocket command to backend method mapping.
- Go string-to-C enum mapping.
- C error code to Go error conversion.
- Fallback behavior when C backend is unavailable.

Use a fake `Backend` for web tests so they do not move the real mouse.

### Manual Platform Tests

Windows:

- Move pointer.
- Left/right click.
- Scroll.
- Type ASCII.
- Type non-ASCII text.
- Alt+Tab behavior.

macOS:

- Confirm permission prompt/setup.
- Repeat Windows input tests.

Linux X11:

- Test direct host run.
- Test Docker only if X11 socket permissions are configured.

Linux Wayland:

- GNOME Wayland.
- KDE Wayland.
- wlroots compositor if available.
- Confirm capability reporting when input is unavailable.
- Confirm native `uinput` behavior where configured.

## Phased Implementation

### Phase 0: Planning Only - Done

Create this plan and make no code changes.

Deliverable:

- `plan.md`

Status:

- Done: `plan.md` exists.

### Phase 1: Native Library Skeleton - Done

Add:

- `server/native/pcinput/include/pcinput.h`
- Core dispatch in `pcinput.c`.
- Error storage in `error.c`.
- Null backend.
- CMake config.

Behavior:

- Compiles on current OS.
- `pc_init()` succeeds with null backend.
- Every unsupported method returns `PCINPUT_ERR_UNSUPPORTED`.
- `pc_backend_name()` returns `null`.

Status:

- Done: added public C ABI in `server/native/pcinput/include/pcinput.h`.
- Done: added native dispatch, null backend, error handling, and backend detection.
- Done: added CMake config for standalone native builds.
- Difference from original phase: on Windows, `pc_init()` now selects the real Windows backend instead of null.
- Cleanup: removed the old `robotgo` backend and dependency after Windows native input was implemented.

### Phase 2: Go C Backend Skeleton - Done

Add:

- `server/internal/input/cbackend.go`
- `server/internal/input/cbackend_disabled.go`

Behavior:

- `INPUT_BACKEND=c` selects C backend when built with tags.
- Without tags, server still builds and existing backends still work.
- Existing WebSocket protocol remains unchanged.

Status:

- Done: added cgo-backed `CBackend` behind `//go:build cgo && pcinput`.
- Done: added disabled stub for normal builds.
- Done: added `INPUT_BACKEND=c`, `c-auto`, `c-windows`, `c-wayland`, `c-linux-uinput`, and `c-macos` routing.
- Done: existing WebSocket command handling remains unchanged.
- Done: forced `INPUT_BACKEND=c*` failures now stay explicit through an unavailable backend instead of silently falling back.
- Done: Windows tagged builds can select `pcinput` by default while normal builds keep the old behavior.
- Done: Go serializes native ABI calls so global native backend/error state is not accessed concurrently.
- Done: Go validates movement and scroll values before converting to `C.int`.
- Done: cgo bridge uses the same `cgo && pcinput` build constraint as the Go native backend.
- Done: Go no longer duplicates Windows detection for native input; it asks `pcinput` for `auto`, and the C layer selects the native backend.
- Done: removed the old `robotgo` backend file and cleaned its dependency tree from `go.mod`/`go.sum`.
- Done: added a native Linux `uinput` backend for Wayland-style input through `/dev/uinput`.
- Done: Docker config no longer installs X11/robotgo-era dependencies and now targets native `pcinput` with `INPUT_BACKEND=c-linux-uinput`.
- Done: removed the Go-side Wayland CLI backend so input implementation is now native C or explicit unavailable.
- Done: added simple Go package API methods: `input.Move`, `input.Click`, `input.Scroll`, `input.TypeString`, `input.Tap`, `input.KeyDown`, and `input.KeyUp`.
- Done: added `.clangd` and `server/internal/input/compile_flags.txt` so editor tooling can resolve `pcinput_bridge.c` source includes.

### Phase 3: Windows Native Backend - Done

Implement:

- Mouse move.
- Click.
- Scroll.
- Special keys.
- UTF-8 typing.

Reason to do early:

- Windows input APIs are stable and straightforward.
- Good proof that the ABI design works.

Status:

- Done: implemented native Windows backend with `SendInput` and `SetCursorPos`.
- Done: implemented relative movement, absolute movement, click, vertical/horizontal scroll, special keys, and UTF-8 text.
- Pending verification: runtime input behavior on an interactive Windows desktop.
- Verified: `go build ./...` passes.
- Verified: `go test ./...` passes.
- Verified: `go build -tags pcinput ./...` passes on Windows with LLVM-MinGW compiler access.
- Verified: `go test -tags pcinput ./...` passes on Windows with LLVM-MinGW compiler access.
- Verified: `CGO_ENABLED=0 go build -tags pcinput ./...` passes after removing the old `robotgo` backend and dependency.
- Not verified: standalone CMake build, because `cmake` is not installed or not available in PATH.
- Not verified: Docker/Compose runtime, because Docker is not installed or not available in PATH and WSL has no installed Linux distributions.

### Phase 4: Linux X11 Native Backend

Implement:

- X11 display open/close.
- Relative and absolute pointer movement.
- Click.
- Scroll.
- Special keys.
- Basic text typing.

Then decide whether X11 should default to C backend.

### Phase 5: macOS Native Backend

Implement:

- Quartz mouse and keyboard events.
- Permission detection where practical.
- Clear permission error messages.

### Phase 6: Wayland Native Strategy

First native target:

- Implement and harden `uinput` backend.
- Report permission requirements.
- Implement capability detection.
- Support relative movement, click, scroll, and key events if `/dev/uinput` is usable.

Second native target:

- Investigate `libei`.
- Add only if real compositor support is available and maintainable.

Third target:

- Portal-based screen/remote-desktop flow if the app grows beyond input control.

### Phase 7: Capability Reporting to Server and Client

Extend server health or add endpoint:

```text
GET /capabilities
```

Response example:

```json
{
  "backend": "pcinput-x11",
  "capabilities": {
    "mouseMoveRelative": true,
    "mouseMoveAbsolute": true,
    "mouseClick": true,
    "mouseScroll": true,
    "keyboardText": true,
    "keyboardKeys": true,
    "screenCapture": false,
    "requiresUserPermission": false,
    "degraded": false
  }
}
```

The mobile client can later hide or disable unsupported controls.

### Phase 8: Cleanup

After C backend is stable:

- Update README to describe native backend installation.
- Add troubleshooting by platform.

## Risks and Mitigations

### Risk: Wayland cannot be fully universal

Mitigation:

- Use explicit capabilities.
- Support multiple Wayland sub-backends.
- Document compositor-specific behavior.

### Risk: cgo complicates builds

Mitigation:

- Keep C backend behind build tag initially.
- Keep old Go backend as fallback.
- Provide build scripts.

### Risk: keyboard layout differences

Mitigation:

- Start with special keys and UTF-8 text.
- Avoid promising raw physical key support until keymap handling is mature.

### Risk: permissions vary by OS

Mitigation:

- Return `PCINPUT_ERR_PERMISSION`.
- Add startup diagnostics.
- Add README setup per platform.

### Risk: tests accidentally move real input

Mitigation:

- Unit-test null/fake backends.
- Keep real input tests manual or gated behind explicit environment variables.

## Definition of Done

Initial architecture is done when:

- Native C library builds.
- Go can select C backend with a build tag.
- Existing app protocol still works.
- At least one real platform backend works without old third-party automation dependencies.
- Capability reporting exists.
- Existing WebSocket protocol still works with native input backends.

Full project goal is done when:

- Windows, macOS, Linux X11 have native backends.
- Wayland reports honest capabilities and supports at least one native path where permissions/compositor allow it.
- README documents platform setup clearly.
- CI compiles all supported backend targets where possible.
