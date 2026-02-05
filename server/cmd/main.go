package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/go-vgo/robotgo"
	"github.com/gorilla/websocket"
	"github.com/grandcat/zeroconf"
)

type Command struct {
	Type  string  `json:"type"`
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	Key   string  `json:"key"`
	Value string  `json:"value"`
	Token string  `json:"token"`
}

var serverPassword string

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// mDNS discovery setup
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
		log.Fatalf("mDNS Error: %v", err)
	}
	defer server.Shutdown()
	log.Printf("mDNS: Service registered as 'PopOS Remote Control'")
	select {}
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

		// Security Check
		if cmd.Token != serverPassword {
			log.Printf("Access Denied: Invalid token from %s", r.RemoteAddr)
			continue
		}

		switch cmd.Type {
		case "move":
			curX, curY := robotgo.Location()
			robotgo.Move(curX+int(cmd.X), curY+int(cmd.Y))
		case "click":
			robotgo.Click("left", false)
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
		}
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	// CORS headers for Android/Expo
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

func main() {
	serverPassword = os.Getenv("SERVER_PASSWORD")
	wsPortEnv := os.Getenv("WS_PORT")

	if serverPassword == "" || wsPortEnv == "" {
		panic("Incorrect env params")
	}

	wsPort, err := strconv.Atoi(wsPortEnv)
	if err != nil {
		panic("Incorrect ws port")
	}

	go startmDNS(wsPort)

	http.HandleFunc("/ws", handleWS)
	http.HandleFunc("/health", handleHealth)

	addrs, _ := net.InterfaceAddrs()
	fmt.Println("------------------------------------")
	fmt.Println("Remote Server Started!")
	fmt.Printf("Port: %d\n", wsPort)
	fmt.Printf("Password: %s\n", serverPassword)
	fmt.Println("Available IP Addresses:")
	for _, a := range addrs {
		if ipnet, ok := a.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ipnet.IP.To4() != nil {
				fmt.Printf(" > %s\n", ipnet.IP.String())
			}
		}
	}
	fmt.Println("------------------------------------")

	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", wsPort),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	if err := server.ListenAndServe(); err != nil {
		log.Fatal("Server Error: ", err)
	}
}
