// Package events carries runtime notifications from the server core to
// whoever hosts it (CLI logger, desktop UI).
package events

import "time"

type Kind int

const (
	Started Kind = iota
	Stopped
	ClientConnected
	ClientDisconnected
	AuthFailed
	InputError
	Info
)

type Event struct {
	Kind    Kind
	Time    time.Time
	Addr    string // remote address for client-related events
	Message string
}

// Handler receives events; it must not block.
type Handler func(Event)

// Emit calls h if it is set, filling in the timestamp.
func (h Handler) Emit(kind Kind, addr string, message string) {
	if h == nil {
		return
	}
	h(Event{Kind: kind, Time: time.Now(), Addr: addr, Message: message})
}

func (k Kind) String() string {
	switch k {
	case Started:
		return "started"
	case Stopped:
		return "stopped"
	case ClientConnected:
		return "client connected"
	case ClientDisconnected:
		return "client disconnected"
	case AuthFailed:
		return "auth failed"
	case InputError:
		return "input error"
	default:
		return "info"
	}
}
