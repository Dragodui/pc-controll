package input

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

type WaylandBackend struct {
	UseWlrctl bool
	UseWtype  bool
}

var ydotoolKeyCodes = map[string]int{
	"alt":       56,
	"backspace": 14,
	"command":   125,
	"enter":     28,
	"shift":     42,
	"space":     57,
	"tab":       15,
}

var ydotoolClickCodes = map[string]string{
	"left":   "0xC0",
	"right":  "0xC1",
	"middle": "0xC2",
}

func (b WaylandBackend) Name() string {
	parts := []string{"wayland-cli"}
	if b.UseWlrctl {
		parts = append(parts, "wlrctl")
	} else {
		parts = append(parts, "ydotool-pointer")
	}
	if b.UseWtype {
		parts = append(parts, "wtype")
	} else {
		parts = append(parts, "ydotool-type")
	}
	parts = append(parts, "ydotool-keys")
	return strings.Join(parts, "+")
}

func (b WaylandBackend) Move(dx, dy int) error {
	if b.UseWlrctl {
		return runInputCmd("wlrctl", "pointer", "move", strconv.Itoa(dx), strconv.Itoa(dy))
	}
	return runInputCmd("ydotool", "mousemove", "-x", strconv.Itoa(dx), "-y", strconv.Itoa(dy))
}

func (b WaylandBackend) Scroll(dx, dy int) error {
	if !b.UseWlrctl {
		return errors.New("scroll on Wayland requires wlrctl")
	}
	return runInputCmd("wlrctl", "pointer", "scroll", strconv.Itoa(dy), strconv.Itoa(dx))
}

func (b WaylandBackend) Click(button string) error {
	if button == "" {
		return nil
	}
	if b.UseWlrctl {
		return runInputCmd("wlrctl", "pointer", "click", button)
	}
	code, ok := ydotoolClickCodes[strings.ToLower(button)]
	if !ok {
		return fmt.Errorf("unsupported mouse button: %s", button)
	}
	return runInputCmd("ydotool", "click", code)
}

func (b WaylandBackend) TypeString(value string) error {
	if value == "" {
		return nil
	}
	if b.UseWtype {
		return runInputCmd("wtype", value)
	}
	return runInputCmd("ydotool", "type", value)
}

func (b WaylandBackend) Tap(key string) error {
	code, err := lookupYdotoolKeyCode(key)
	if err != nil {
		return err
	}
	return runInputCmd("ydotool", "key", fmt.Sprintf("%d:1", code), fmt.Sprintf("%d:0", code))
}

func (b WaylandBackend) KeyDown(key string) error {
	code, err := lookupYdotoolKeyCode(key)
	if err != nil {
		return err
	}
	return runInputCmd("ydotool", "key", fmt.Sprintf("%d:1", code))
}

func (b WaylandBackend) KeyUp(key string) error {
	code, err := lookupYdotoolKeyCode(key)
	if err != nil {
		return err
	}
	return runInputCmd("ydotool", "key", fmt.Sprintf("%d:0", code))
}

func lookupYdotoolKeyCode(key string) (int, error) {
	code, ok := ydotoolKeyCodes[strings.ToLower(strings.TrimSpace(key))]
	if !ok {
		return 0, fmt.Errorf("unsupported key for Wayland backend: %s", key)
	}
	return code, nil
}

func runInputCmd(name string, args ...string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, name, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		if len(output) == 0 {
			return fmt.Errorf("%s failed: %w", name, err)
		}
		return fmt.Errorf("%s failed: %w: %s", name, err, strings.TrimSpace(string(output)))
	}
	return nil
}
