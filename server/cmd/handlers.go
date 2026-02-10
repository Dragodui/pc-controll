package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/go-vgo/robotgo"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func handleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
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

		var cmd Command
		if err := json.Unmarshal(message, &cmd); err != nil {
			continue
		}

		if cmd.Token != serverPassword {
			log.Printf("Access Denied: Invalid token from %s", r.RemoteAddr)
			continue
		}

		processCommand(cmd, conn)
	}
}

func processCommand(cmd Command, conn *websocket.Conn) {
	switch cmd.Type {
	case "move":
		curX, curY := robotgo.Location()
		robotgo.Move(curX+int(cmd.X), curY+int(cmd.Y))
	case "scroll":
		robotgo.Scroll(int(cmd.X), int(cmd.Y))
	case "click":
		robotgo.Click(cmd.Button, false)
	case "type_string":
		if cmd.Value != "" {
			robotgo.Type(cmd.Value)
		}
	case "tap":
		if cmd.Key != "" {
			robotgo.KeyTap(cmd.Key)
		}
	case "key_down":
		if cmd.Key != "" {
			robotgo.KeyDown(cmd.Key)
			time.Sleep(20 * time.Millisecond)
		}
	case "key_up":
		if cmd.Key != "" {
			robotgo.KeyUp(cmd.Key)
		}
	case "media":
		robotgo.KeyTap(cmd.Value)
	case "system":
		handleSystemCommand(cmd.Value)
	case "clipboard_set":
		robotgo.WriteAll(cmd.Value)
	case "clipboard_get":
		text, _ := robotgo.ReadAll()
		conn.WriteJSON(map[string]string{
			"type":  "clipboard",
			"value": text,
		})
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
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
