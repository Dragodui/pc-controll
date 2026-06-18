package input

import "sync"

var (
	defaultOnce    sync.Once
	defaultBackend Backend
)

func DefaultBackend() Backend {
	defaultOnce.Do(func() {
		defaultBackend = DetectBackend()
	})
	return defaultBackend
}

func Move(dx, dy int) error {
	return DefaultBackend().Move(dx, dy)
}

func Scroll(dx, dy int) error {
	return DefaultBackend().Scroll(dx, dy)
}

func Click(button string) error {
	return DefaultBackend().Click(button)
}

func TypeString(value string) error {
	return DefaultBackend().TypeString(value)
}

func Tap(key string) error {
	return DefaultBackend().Tap(key)
}

func KeyDown(key string) error {
	return DefaultBackend().KeyDown(key)
}

func KeyUp(key string) error {
	return DefaultBackend().KeyUp(key)
}
