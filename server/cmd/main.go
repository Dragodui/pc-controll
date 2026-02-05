package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/go-vgo/robotgo"
	"github.com/gorilla/websocket"
	"github.com/grandcat/zeroconf"
)

// Command structure for incoming requests
type Command struct {
	Type   string  `json:"type"` // move, click, scroll, tap
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Button string  `json:"button"` // left, right, center
	Key    string  `json:"key"`
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for local network access
	},
}

// startmDNS announces the service on the local network
func startmDNS(port int) {
	server, err := zeroconf.Register(
		"PopOS Remote Control",
		"_remotepad._tcp",
		"local.",
		port,
		[]string{"txtv=1", "app=go-remote"},
		nil,
	)
	if err != nil {
		log.Fatalf("mDNS Registration Error: %v", err)
	}
	defer server.Shutdown()

	log.Printf("mDNS service registered: PopOS Remote Control on port %d", port)
	select {}
}

func handleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket Upgrade Error: %v", err)
		return
	}
	defer conn.Close()

	log.Printf("New client connected: %s", r.RemoteAddr)

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			log.Printf("Client disconnected or connection lost: %v", err)
			break
		}

		var cmd Command
		if err := json.Unmarshal(message, &cmd); err != nil {
			log.Printf("Failed to parse command: %v", err)
			continue
		}

		// RobotGo execution logic
		switch cmd.Type {
		case "move":
			curX, curY := robotgo.Location()
			robotgo.Move(curX+int(cmd.X), curY+int(cmd.Y))

		case "click":
			btn := "left"
			if cmd.Button != "" {
				btn = cmd.Button
			}
			robotgo.Click(btn, false)
			log.Printf("Action: Mouse Click [%s]", btn)

		case "scroll":
			direction := "down"
			if cmd.Y > 0 {
				direction = "up"
			}
			robotgo.ScrollDir(1, direction)

		case "tap":
			if cmd.Key != "" {
				robotgo.KeyTap(cmd.Key)
				log.Printf("Action: Key Tap [%s]", cmd.Key)
			}
		}
	}
}

func main() {
	const Port = 1488

	// Start mDNS in a separate goroutine
	go startmDNS(Port)

	http.HandleFunc("/ws", handleWS)
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Server is running on Pop!_OS")
	})

	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", Port),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	log.Printf("Remote Control Server started on :%d", Port)
	log.Printf("Wait for connections from mobile app...")

	if err := server.ListenAndServe(); err != nil {
		log.Fatal("ListenAndServe Error: ", err)
	}
}
