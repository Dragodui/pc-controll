package desktop

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/Dragodui/pc-controll/internal/appconfig"
	"github.com/Dragodui/pc-controll/internal/events"
	"github.com/Dragodui/pc-controll/internal/input"
	"github.com/Dragodui/pc-controll/internal/server"
	"github.com/Dragodui/pc-controll/internal/web"
)

const logLines = 200

// controller owns the server lifecycle and a bounded log. The UI reads
// state from it and subscribes to changes through onChange.
type controller struct {
	mu       sync.Mutex
	srv      *server.Server
	backend  input.Backend
	lines    []string
	onChange func()
}

func newController() *controller {
	return &controller{backend: input.DefaultBackend()}
}

func (c *controller) running() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.srv != nil && c.srv.Running()
}

func (c *controller) clients() []web.Client {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.srv == nil {
		return nil
	}
	return c.srv.Clients()
}

func (c *controller) logText() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return strings.Join(c.lines, "\n")
}

// backendStatus is the one-line explanation shown under the Start button.
func (c *controller) backendStatus() (ok bool, text string) {
	if _, is := c.backend.(input.UnavailableBackend); is {
		return false, platformHint()
	}
	return true, c.backend.Name()
}

func (c *controller) start(cfg appconfig.Config) error {
	c.mu.Lock()
	if c.srv != nil && c.srv.Running() {
		c.mu.Unlock()
		return nil
	}
	srv := server.New(server.Options{
		Name:     cfg.Name,
		Port:     cfg.Port,
		Password: cfg.Password,
		Backend:  c.backend,
		Events:   c.handleEvent,
	})
	c.srv = srv
	c.mu.Unlock()

	// Start emits events synchronously, and handleEvent takes c.mu: do not hold it here.
	if err := srv.Start(); err != nil {
		c.mu.Lock()
		if c.srv == srv {
			c.srv = nil
		}
		c.appendLocked(fmt.Sprintf("start failed: %v", err))
		c.mu.Unlock()
		return err
	}
	return nil
}

func (c *controller) stop() {
	c.mu.Lock()
	srv := c.srv
	c.mu.Unlock()
	if srv == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	srv.Stop(ctx)
}

func (c *controller) handleEvent(e events.Event) {
	c.mu.Lock()
	line := e.Time.Format("15:04:05") + " " + e.Message
	if e.Addr != "" {
		line += " (" + e.Addr + ")"
	}
	c.appendLocked(line)
	onChange := c.onChange
	c.mu.Unlock()
	if onChange != nil {
		onChange()
	}
}

func (c *controller) appendLocked(line string) {
	c.lines = append(c.lines, line)
	if len(c.lines) > logLines {
		c.lines = c.lines[len(c.lines)-logLines:]
	}
}
