package input

import "sync"

var (
	defaultOnce    sync.Once
	defaultBackend Backend
)

// DefaultBackend resolves the native backend once per process.
func DefaultBackend() Backend {
	defaultOnce.Do(func() {
		defaultBackend = NewBackend()
	})
	return defaultBackend
}
