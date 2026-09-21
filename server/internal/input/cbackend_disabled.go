//go:build !cgo || !pcinput

package input

import "errors"

func NewCBackend() (Backend, error) {
	return nil, errors.New("pcinput backend is unavailable; rebuild with cgo and -tags pcinput")
}
