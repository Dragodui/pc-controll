package wsapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"github.com/Dragodui/pc-controll/internal/protocol"
)

// recordingBackend notes the calls the WS handler dispatches.
type recordingBackend struct {
	mu    sync.Mutex
	calls []string
}

func (b *recordingBackend) note(call string) {
	b.mu.Lock()
	b.calls = append(b.calls, call)
	b.mu.Unlock()
}

func (b *recordingBackend) seen() []string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return append([]string(nil), b.calls...)
}

func (b *recordingBackend) Name() string                  { return "recording" }
func (b *recordingBackend) Move(dx, dy int) error         { b.note("move"); return nil }
func (b *recordingBackend) Scroll(dx, dy int) error       { b.note("scroll"); return nil }
func (b *recordingBackend) Click(button string) error     { b.note("click:" + button); return nil }
func (b *recordingBackend) TypeString(value string) error { b.note("type:" + value); return nil }
func (b *recordingBackend) Tap(key string) error          { b.note("tap:" + key); return nil }
func (b *recordingBackend) KeyDown(key string) error      { b.note("down:" + key); return nil }
func (b *recordingBackend) KeyUp(key string) error        { b.note("up:" + key); return nil }

func dial(t *testing.T, password string) (*httptest.Server, *recordingBackend, *websocket.Conn) {
	t.Helper()
	backend := &recordingBackend{}
	handler := NewServer(password, backend, nil)
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", handler.HandleWS)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	conn, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(srv.URL, "http")+"/ws", nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	t.Cleanup(func() { conn.Close() })
	return srv, backend, conn
}

func send(t *testing.T, conn *websocket.Conn, cmd protocol.Command) {
	t.Helper()
	if err := conn.WriteJSON(cmd); err != nil {
		t.Fatalf("write: %v", err)
	}
}

func readReply(t *testing.T, conn *websocket.Conn) protocol.Reply {
	t.Helper()
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, data, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	var reply protocol.Reply
	if err := json.Unmarshal(data, &reply); err != nil {
		t.Fatalf("unmarshal %q: %v", data, err)
	}
	return reply
}

func TestWrongPasswordIsRejectedAndClosesTheConnection(t *testing.T) {
	_, backend, conn := dial(t, "secret")

	send(t, conn, protocol.Command{Type: protocol.TypeAuth, Token: "wrong"})
	if reply := readReply(t, conn); reply.Type != protocol.TypeAuthError {
		t.Fatalf("expected %s, got %+v", protocol.TypeAuthError, reply)
	}

	// The server hangs up, so a client cannot keep guessing on one socket.
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	if _, _, err := conn.ReadMessage(); err == nil {
		t.Fatal("expected the connection to be closed after a bad password")
	}
	if calls := backend.seen(); len(calls) != 0 {
		t.Fatalf("no input should have run, got %v", calls)
	}
}

func TestAuthThenCommandsAreDispatched(t *testing.T) {
	_, backend, conn := dial(t, "secret")

	send(t, conn, protocol.Command{Type: protocol.TypeAuth, Token: "secret"})
	if reply := readReply(t, conn); reply.Type != protocol.TypeAuthOK {
		t.Fatalf("expected %s, got %+v", protocol.TypeAuthOK, reply)
	}

	send(t, conn, protocol.Command{Type: "click", Button: "right", Token: "secret"})
	send(t, conn, protocol.Command{Type: "tap", Key: "enter", Token: "secret"})
	// The auth reply arrives before the commands run; poll until both land.
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) && len(backend.seen()) < 2 {
		time.Sleep(10 * time.Millisecond)
	}
	calls := backend.seen()
	if len(calls) != 2 || calls[0] != "click:right" || calls[1] != "tap:enter" {
		t.Fatalf("unexpected calls %v", calls)
	}
}

// Older clients send a real command first instead of an explicit auth message.
func TestFirstCommandAuthenticates(t *testing.T) {
	_, backend, conn := dial(t, "secret")

	send(t, conn, protocol.Command{Type: "click", Button: "left", Token: "secret"})
	if reply := readReply(t, conn); reply.Type != protocol.TypeAuthOK {
		t.Fatalf("expected %s, got %+v", protocol.TypeAuthOK, reply)
	}
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) && len(backend.seen()) == 0 {
		time.Sleep(10 * time.Millisecond)
	}
	if calls := backend.seen(); len(calls) != 1 || calls[0] != "click:left" {
		t.Fatalf("unexpected calls %v", calls)
	}
}

func TestClientsListedOnlyAfterAuth(t *testing.T) {
	backend := &recordingBackend{}
	handler := NewServer("secret", backend, nil)
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", handler.HandleWS)
	srv := httptest.NewServer(mux)
	defer srv.Close()

	conn, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(srv.URL, "http")+"/ws", nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer conn.Close()

	if got := handler.Clients(); len(got) != 0 {
		t.Fatalf("an unauthenticated socket must not count as a client, got %v", got)
	}
	send(t, conn, protocol.Command{Type: protocol.TypeAuth, Token: "secret"})
	readReply(t, conn)

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) && len(handler.Clients()) == 0 {
		time.Sleep(10 * time.Millisecond)
	}
	if got := handler.Clients(); len(got) != 1 {
		t.Fatalf("expected one client, got %v", got)
	}
}
