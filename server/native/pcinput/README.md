# pcinput

`pcinput` is the native C input backend used by the Go server when built with the `pcinput` tag.

Current implementation status:

- Windows: native mouse and keyboard input through Win32 APIs.
- Linux: native `uinput` virtual input backend where `/dev/uinput` is available. Basic ASCII is typed as key events; Unicode text uses clipboard paste through `wl-copy`, `xclip`, or `xsel`.
- Other platforms: null backend only, returning unsupported capability/errors until their backends are implemented.

Standalone build:

```bash
cmake -S . -B build
cmake --build build
```

Go build from `server/`:

```bash
go build ./...
go build -tags pcinput ./...
```

The Go `pcinput` build compiles the C sources through cgo, so it does not require the CMake artifact yet.
