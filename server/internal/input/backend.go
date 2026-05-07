package input

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
