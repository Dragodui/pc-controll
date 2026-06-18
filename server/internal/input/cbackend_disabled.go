//go:build !cgo || !pcinput

package input

import "errors"

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
	return nil, errors.New("pcinput backend is unavailable; rebuild with cgo and -tags pcinput")
}
