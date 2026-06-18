package input

import "fmt"

type Backend interface {
	Name() string
	Move(dx, dy int) error
	Scroll(dx, dy int) error
	Click(button string) error
	TypeString(value string) error
	Tap(key string) error
	KeyDown(key string) error
	KeyUp(key string) error
}

type UnavailableBackend struct {
	BackendName string
	Err         error
}

func (b UnavailableBackend) Name() string {
	return b.BackendName
}

func (b UnavailableBackend) Move(dx, dy int) error {
	return b.err()
}

func (b UnavailableBackend) Scroll(dx, dy int) error {
	return b.err()
}

func (b UnavailableBackend) Click(button string) error {
	return b.err()
}

func (b UnavailableBackend) TypeString(value string) error {
	return b.err()
}

func (b UnavailableBackend) Tap(key string) error {
	return b.err()
}

func (b UnavailableBackend) KeyDown(key string) error {
	return b.err()
}

func (b UnavailableBackend) KeyUp(key string) error {
	return b.err()
}

func (b UnavailableBackend) err() error {
	if b.Err == nil {
		return fmt.Errorf("%s is unavailable", b.BackendName)
	}
	return fmt.Errorf("%s is unavailable: %w", b.BackendName, b.Err)
}
