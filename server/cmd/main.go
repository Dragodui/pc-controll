package main

import (
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"time"

	"github.com/grandcat/zeroconf"
)

var serverPassword string
var pcName string

type noDelayListener struct {
	*net.TCPListener
}

func (l noDelayListener) Accept() (net.Conn, error) {
	conn, err := l.TCPListener.AcceptTCP()
	if err != nil {
		return nil, err
	}
	if err := conn.SetNoDelay(true); err != nil {
		conn.Close()
		return nil, err
	}
	return conn, nil
}

func startmDNS(port int) {
	server, err := zeroconf.Register(
		pcName,
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
	log.Printf("mDNS: Service registered as '%s'", pcName)
	select {}
}

func main() {
	serverPassword = os.Getenv("SERVER_PASSWORD")
	wsPortEnv := os.Getenv("WS_PORT")
	pcName = os.Getenv("PC_NAME")

	if pcName == "" {
		pcName = "Remote PC"
	}

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
	fmt.Printf("OS: %s (%s)\n", runtime.GOOS, runtime.GOARCH)
	fmt.Printf("PC Name: %s\n", pcName)
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

	rawListener, err := net.Listen("tcp", server.Addr)
	if err != nil {
		log.Fatal("Listen Error: ", err)
	}
	tcpListener, ok := rawListener.(*net.TCPListener)
	if !ok {
		log.Fatal("Listener Error: not a TCP listener")
	}

	if err := server.Serve(noDelayListener{TCPListener: tcpListener}); err != nil {
		log.Fatal("Server Error: ", err)
	}
}