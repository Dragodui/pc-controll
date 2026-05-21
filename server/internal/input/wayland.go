package input

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"
)

type WaylandBackend struct {
	UseWlrctl       bool
	UseWtype        bool
	mu              sync.Mutex
	activeModifiers map[string]bool
	moveDX          int
	moveDY          int
	moveNotify      chan struct{}
}

var ydotoolKeyNames = map[string]string{
	"alt":       "KEY_LEFTALT",
	"backspace": "KEY_BACKSPACE",
	"command":   "KEY_LEFTMETA",
	"enter":     "KEY_ENTER",
	"shift":     "KEY_LEFTSHIFT",
	"space":     "KEY_SPACE",
	"tab":       "KEY_TAB",
}

var ydotoolModifierOrder = []string{"command", "alt", "shift"}

var ydotoolClickCodes = map[string]string{
	"left":   "0xC0",
	"right":  "0xC1",
	"middle": "0xC2",
}

func (b *WaylandBackend) Name() string {
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

func (b *WaylandBackend) Move(dx, dy int) error {
	if b.UseWlrctl {
		return runInputCmd("wlrctl", "pointer", "move", strconv.Itoa(dx), strconv.Itoa(dy))
	}
	b.queueMove(dx, dy)
	return nil
}

func (b *WaylandBackend) Scroll(dx, dy int) error {
	if !b.UseWlrctl {
		return errors.New("scroll on Wayland requires wlrctl")
	}
	return runInputCmd("wlrctl", "pointer", "scroll", strconv.Itoa(dy), strconv.Itoa(dx))
}

func (b *WaylandBackend) Click(button string) error {
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

func (b *WaylandBackend) TypeString(value string) error {
	if value == "" {
		return nil
	}
	if b.UseWtype {
		return runInputCmd("wtype", value)
	}
	return runInputCmd("ydotool", "type", value)
}

func (b *WaylandBackend) Tap(key string) error {
	keyName, normalizedKey, err := lookupYdotoolKeyName(key)
	if err != nil {
		return err
	}

	return runInputCmd("ydotool", "key", b.keySequence(keyName, normalizedKey))
}

func (b *WaylandBackend) keySequence(keyName string, normalizedKey string) string {
	b.mu.Lock()
	defer b.mu.Unlock()

	parts := make([]string, 0, len(ydotoolModifierOrder)+1)
	for _, modifier := range ydotoolModifierOrder {
		if modifier == normalizedKey {
			continue
		}
		if b.activeModifiers[modifier] {
			parts = append(parts, ydotoolKeyNames[modifier])
		}
	}
	parts = append(parts, keyName)
	return strings.Join(parts, "+")
}

func (b *WaylandBackend) KeyDown(key string) error {
	_, normalizedKey, err := lookupYdotoolKeyName(key)
	if err != nil {
		return err
	}
	if !isYdotoolModifier(normalizedKey) {
		return b.Tap(normalizedKey)
	}
	b.mu.Lock()
	b.activeModifiers[normalizedKey] = true
	b.mu.Unlock()
	return nil
}

func (b *WaylandBackend) KeyUp(key string) error {
	_, normalizedKey, err := lookupYdotoolKeyName(key)
	if err != nil {
		return err
	}
	b.mu.Lock()
	delete(b.activeModifiers, normalizedKey)
	b.mu.Unlock()
	return nil
}

func lookupYdotoolKeyName(key string) (string, string, error) {
	normalizedKey := strings.ToLower(strings.TrimSpace(key))
	keyName, ok := ydotoolKeyNames[normalizedKey]
	if !ok {
		return "", "", fmt.Errorf("unsupported key for Wayland backend: %s", key)
	}
	return keyName, normalizedKey, nil
}

func isYdotoolModifier(key string) bool {
	for _, modifier := range ydotoolModifierOrder {
		if key == modifier {
			return true
		}
	}
	return false
}

func (b *WaylandBackend) queueMove(dx, dy int) {
	if dx == 0 && dy == 0 {
		return
	}

	b.mu.Lock()
	b.moveDX += dx
	b.moveDY += dy
	b.mu.Unlock()

	select {
	case b.moveNotify <- struct{}{}:
	default:
	}
}

func (b *WaylandBackend) startMoveWorker() {
	go func() {
		ticker := time.NewTicker(25 * time.Millisecond)
		defer ticker.Stop()

		for {
			select {
			case <-b.moveNotify:
			case <-ticker.C:
			}

			dx, dy := b.takeQueuedMove()
			if dx == 0 && dy == 0 {
				continue
			}
			if err := runInputCmd("ydotool", "mousemove", "--", strconv.Itoa(dx), strconv.Itoa(dy)); err != nil {
				log.Printf("Input command failed [coalesced move via ydotool]: %v", err)
			}
		}
	}()
}

func (b *WaylandBackend) takeQueuedMove() (int, int) {
	b.mu.Lock()
	defer b.mu.Unlock()

	dx := b.moveDX
	dy := b.moveDY
	b.moveDX = 0
	b.moveDY = 0
	return dx, dy
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
	if hasInputCmdError(output) {
		return fmt.Errorf("%s failed: %s", name, strings.TrimSpace(string(output)))
	}
	return nil
}

func hasInputCmdError(output []byte) bool {
	value := strings.ToLower(string(output))
	return strings.Contains(value, "error:") || strings.Contains(value, "failed to open")
}
