package server

import (
	"fmt"
	"net"
	"net/http"
	"os"
	"time"

	"github.com/Dragodui/pc-controll/internal/config"
	"github.com/Dragodui/pc-controll/internal/discovery"
	"github.com/Dragodui/pc-controll/internal/input"
	"github.com/Dragodui/pc-controll/internal/web"
)

func Run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	backend := input.DetectBackend()

	go discovery.StartMDNS(cfg.PCName, cfg.WSPort)

	handler := web.NewServer(cfg.ServerPassword, backend)

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", handler.HandleWS)
	mux.HandleFunc("/health", handler.HandleHealth)

	printStartupInfo(cfg, backend.Name())

	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.WSPort),
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	rawListener, err := net.Listen("tcp", server.Addr)
	if err != nil {
		return fmt.Errorf("listen error: %w", err)
	}
	tcpListener, ok := rawListener.(*net.TCPListener)
	if !ok {
		return fmt.Errorf("listener error: not a TCP listener")
	}

	return server.Serve(noDelayListener{TCPListener: tcpListener})
}

func printStartupInfo(cfg config.Config, backendName string) {
	addrs, _ := net.InterfaceAddrs()
	fmt.Println("------------------------------------")
	fmt.Println("Remote Server Started!")
	fmt.Printf("Port: %d\n", cfg.WSPort)
	fmt.Printf("Password: %s\n", cfg.ServerPassword)
	fmt.Printf("Input Backend: %s\n", backendName)
	fmt.Printf("Session Type: %s\n", firstNonEmpty(os.Getenv("XDG_SESSION_TYPE"), "unknown"))
	fmt.Println("Available IP Addresses:")
	for _, a := range addrs {
		if ipnet, ok := a.(*net.IPNet); ok && !ipnet.IP.IsLoopback() && ipnet.IP.To4() != nil {
			fmt.Printf(" > %s\n", ipnet.IP.String())
		}
	}
	fmt.Println("------------------------------------")
}

func firstNonEmpty(value string, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
