//go:build cgo && pcinput

package input

/*
#cgo CFLAGS: -I${SRCDIR}/../../native/pcinput/include
#cgo windows LDFLAGS: -luser32
#include <stdlib.h>
#include "pcinput.h"
*/
import "C"

import (
	"fmt"
	"strings"
	"sync"
	"unsafe"
)

type CBackend struct{}

var pcinputMu sync.Mutex

type Capabilities struct {
	MouseMoveRelative bool
	MouseMoveAbsolute bool
	MouseClick        bool
	MouseScroll       bool
	KeyboardText      bool
	KeyboardKeys      bool
	ScreenCapture     bool
	RequiresUserPerm  bool
	Degraded          bool
}

func NewCBackend() (Backend, error) {
	pcinputMu.Lock()
	defer pcinputMu.Unlock()

	if result := C.pc_init(); result != C.PCINPUT_OK {
		return nil, pcinputError("initialize pcinput", result)
	}
	if C.GoString(C.pc_backend_name()) == "null" {
		return nil, fmt.Errorf("pcinput resolved to null; no native backend is available on this platform yet")
	}
	return CBackend{}, nil
}

func (b CBackend) Name() string {
	pcinputMu.Lock()
	defer pcinputMu.Unlock()

	name := C.GoString(C.pc_backend_name())
	if name == "" {
		name = "unknown"
	}
	return "pcinput-" + name
}

func (b CBackend) Capabilities() (Capabilities, error) {
	var caps C.pc_caps_t

	pcinputMu.Lock()
	defer pcinputMu.Unlock()

	if result := C.pc_get_capabilities(&caps); result != C.PCINPUT_OK {
		return Capabilities{}, pcinputError("get pcinput capabilities", result)
	}
	return Capabilities{
		MouseMoveRelative: caps.mouse_move_relative != 0,
		MouseMoveAbsolute: caps.mouse_move_absolute != 0,
		MouseClick:        caps.mouse_click != 0,
		MouseScroll:       caps.mouse_scroll != 0,
		KeyboardText:      caps.keyboard_text != 0,
		KeyboardKeys:      caps.keyboard_keys != 0,
		ScreenCapture:     caps.screen_capture != 0,
		RequiresUserPerm:  caps.requires_user_permission != 0,
		Degraded:          caps.degraded != 0,
	}, nil
}

func (b CBackend) Move(dx, dy int) error {
	cdx, err := checkedCInt(dx, "mouse dx")
	if err != nil {
		return err
	}
	cdy, err := checkedCInt(dy, "mouse dy")
	if err != nil {
		return err
	}

	pcinputMu.Lock()
	defer pcinputMu.Unlock()

	if result := C.pc_mouse_move_relative(cdx, cdy); result != C.PCINPUT_OK {
		return pcinputError("move mouse", result)
	}
	return nil
}

func (b CBackend) Scroll(dx, dy int) error {
	cdx, err := checkedCInt(dx, "scroll dx")
	if err != nil {
		return err
	}
	cdy, err := checkedCInt(dy, "scroll dy")
	if err != nil {
		return err
	}

	pcinputMu.Lock()
	defer pcinputMu.Unlock()

	if result := C.pc_mouse_scroll(cdx, cdy); result != C.PCINPUT_OK {
		return pcinputError("scroll mouse", result)
	}
	return nil
}

func (b CBackend) Click(button string) error {
	translated, err := pcinputButton(button)
	if err != nil {
		return err
	}

	pcinputMu.Lock()
	defer pcinputMu.Unlock()

	if result := C.pc_mouse_click(translated); result != C.PCINPUT_OK {
		return pcinputError("click mouse", result)
	}
	return nil
}

func (b CBackend) TypeString(value string) error {
	if value == "" {
		return nil
	}
	cvalue := C.CString(value)
	defer C.free(unsafe.Pointer(cvalue))

	pcinputMu.Lock()
	defer pcinputMu.Unlock()

	if result := C.pc_keyboard_type_utf8(cvalue); result != C.PCINPUT_OK {
		return pcinputError("type text", result)
	}
	return nil
}

func (b CBackend) Tap(key string) error {
	translated, err := pcinputKey(key)
	if err != nil {
		return err
	}

	pcinputMu.Lock()
	defer pcinputMu.Unlock()

	if result := C.pc_keyboard_tap(translated); result != C.PCINPUT_OK {
		return pcinputError("tap key", result)
	}
	return nil
}

func (b CBackend) KeyDown(key string) error {
	translated, err := pcinputKey(key)
	if err != nil {
		return err
	}

	pcinputMu.Lock()
	defer pcinputMu.Unlock()

	if result := C.pc_keyboard_down(translated); result != C.PCINPUT_OK {
		return pcinputError("press key", result)
	}
	return nil
}

func (b CBackend) KeyUp(key string) error {
	translated, err := pcinputKey(key)
	if err != nil {
		return err
	}

	pcinputMu.Lock()
	defer pcinputMu.Unlock()

	if result := C.pc_keyboard_up(translated); result != C.PCINPUT_OK {
		return pcinputError("release key", result)
	}
	return nil
}

func checkedCInt(value int, name string) (C.int, error) {
	const maxCInt = int64(1<<31 - 1)
	const minCInt = -1 << 31

	if int64(value) < minCInt || int64(value) > maxCInt {
		return 0, fmt.Errorf("%s value %d is outside C int range", name, value)
	}
	return C.int(value), nil
}

func pcinputButton(button string) (C.pc_mouse_button_t, error) {
	switch strings.ToLower(strings.TrimSpace(button)) {
	case "", "left":
		return C.PC_MOUSE_LEFT, nil
	case "right":
		return C.PC_MOUSE_RIGHT, nil
	case "middle":
		return C.PC_MOUSE_MIDDLE, nil
	default:
		return 0, fmt.Errorf("unsupported mouse button for pcinput backend: %s", button)
	}
}

func pcinputKey(key string) (C.pc_key_t, error) {
	switch strings.ToLower(strings.TrimSpace(key)) {
	case "alt":
		return C.PC_KEY_ALT, nil
	case "backspace":
		return C.PC_KEY_BACKSPACE, nil
	case "command":
		return C.PC_KEY_COMMAND, nil
	case "enter":
		return C.PC_KEY_ENTER, nil
	case "shift":
		return C.PC_KEY_SHIFT, nil
	case "space":
		return C.PC_KEY_SPACE, nil
	case "tab":
		return C.PC_KEY_TAB, nil
	default:
		return 0, fmt.Errorf("unsupported key for pcinput backend: %s", key)
	}
}

func pcinputError(operation string, code C.int) error {
	message := C.GoString(C.pc_last_error())
	if message == "" {
		message = "no native error message"
	}
	return fmt.Errorf("%s failed with pcinput code %d: %s", operation, int(code), message)
}
