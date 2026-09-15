package web

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"sync"
	"time"

	"github.com/Dragodui/pc-controll/internal/events"
	"github.com/Dragodui/pc-controll/internal/input"
	"github.com/Dragodui/pc-controll/internal/protocol"
	"github.com/gorilla/websocket"
)

// Client is a phone currently connected over WebSocket.
type Client struct {
	Addr  string
	Since time.Time
}

type Server struct {
	serverPassword string
	backend        input.Backend
	upgrader       websocket.Upgrader
	emit           events.Handler

	mu      sync.Mutex
	clients map[string]Client
}

func NewServer(serverPassword string, backend input.Backend, emit events.Handler) *Server {
	return &Server{
		serverPassword: serverPassword,
		backend:        backend,
		emit:           emit,
		clients:        make(map[string]Client),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
	}
}

// Clients returns connected phones, oldest first.
func (s *Server) Clients() []Client {
	s.mu.Lock()
	defer s.mu.Unlock()
	list := make([]Client, 0, len(s.clients))
	for _, c := range s.clients {
		list = append(list, c)
	}
	sort.Slice(list, func(i, j int) bool { return list[i].Since.Before(list[j].Since) })
	return list
}

func (s *Server) addClient(addr string) {
	s.mu.Lock()
	s.clients[addr] = Client{Addr: addr, Since: time.Now()}
	s.mu.Unlock()
	s.emit.Emit(events.ClientConnected, addr, "client connected")
}

func (s *Server) removeClient(addr string, reason error) {
	s.mu.Lock()
	delete(s.clients, addr)
	s.mu.Unlock()
	s.emit.Emit(events.ClientDisconnected, addr, fmt.Sprintf("client disconnected: %v", reason))
}

func (s *Server) HandleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		s.emit.Emit(events.Info, r.RemoteAddr, fmt.Sprintf("WS upgrade error: %v", err))
		return
	}
	defer conn.Close()

	addr := r.RemoteAddr
	s.addClient(addr)

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			s.removeClient(addr, err)
			break
		}

		var cmd protocol.Command
		if err := json.Unmarshal(message, &cmd); err != nil {
			continue
		}
		if cmd.Token != s.serverPassword {
			s.emit.Emit(events.AuthFailed, addr, "access denied: invalid token")
			continue
		}
		if err := s.executeCommand(cmd); err != nil {
			s.emit.Emit(events.InputError, addr, fmt.Sprintf("input command failed [%s via %s]: %v", cmd.Type, s.backend.Name(), err))
		}
	}
}

func (s *Server) HandleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "OK")
}

func (s *Server) executeCommand(cmd protocol.Command) error {
	switch cmd.Type {
	case "move":
		return s.backend.Move(int(cmd.X), int(cmd.Y))
	case "scroll":
		return s.backend.Scroll(int(cmd.X), int(cmd.Y))
	case "click":
		return s.backend.Click(cmd.Button)
	case "type_string":
		return s.backend.TypeString(cmd.Value)
	case "tap":
		return s.backend.Tap(cmd.Key)
	case "key_down":
		return s.backend.KeyDown(cmd.Key)
	case "key_up":
		return s.backend.KeyUp(cmd.Key)
	default:
		return nil
	}
}
