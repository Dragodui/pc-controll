package input

import (
	"time"

	"github.com/go-vgo/robotgo"
)

type RobotBackend struct{}

func (b RobotBackend) Name() string {
	return "robotgo"
}

func (b RobotBackend) Move(dx, dy int) error {
	curX, curY := robotgo.Location()
	robotgo.Move(curX+dx, curY+dy)
	return nil
}

func (b RobotBackend) Scroll(dx, dy int) error {
	robotgo.Scroll(dx, dy)
	return nil
}

func (b RobotBackend) Click(button string) error {
	robotgo.Click(button, false)
	return nil
}

func (b RobotBackend) TypeString(value string) error {
	if value == "" {
		return nil
	}
	robotgo.Type(value)
	return nil
}

func (b RobotBackend) Tap(key string) error {
	if key == "" {
		return nil
	}
	robotgo.KeyTap(key)
	return nil
}

func (b RobotBackend) KeyDown(key string) error {
	if key == "" {
		return nil
	}
	robotgo.KeyDown(key)
	time.Sleep(20 * time.Millisecond)
	return nil
}

func (b RobotBackend) KeyUp(key string) error {
	if key == "" {
		return nil
	}
	robotgo.KeyUp(key)
	return nil
}
