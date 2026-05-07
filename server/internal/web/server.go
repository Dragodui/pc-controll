package web

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/Dragodui/pc-controll/internal/input"
	"github.com/Dragodui/pc-controll/internal/protocol"
	"github.com/gorilla/websocket"
)

type Server struct {
	serverPassword string
	backend        input.Backend
	upgrader       websocket.Upgrader
}

func NewServer(serverPassword string, backend input.Backend) *Server {
	return &Server{
		serverPassword: serverPassword,
		backend:        backend,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
	}
}

func (s *Server) HandleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WS Upgrade Error: %v", err)
		return
	}
	defer conn.Close()

	log.Printf("Client connected: %s", r.RemoteAddr)

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			log.Printf("Client disconnected: %v", err)
			break
		}

		var cmd protocol.Command
		if err := json.Unmarshal(message, &cmd); err != nil {
			continue
		}
		if cmd.Token != s.serverPassword {
			log.Printf("Access Denied: Invalid token from %s", r.RemoteAddr)
			continue
		}
		if err := s.executeCommand(cmd); err != nil {
			log.Printf("Input command failed [%s via %s]: %v", cmd.Type, s.backend.Name(), err)
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

	log.Printf("Health Check Ping from: %s", r.RemoteAddr)
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
