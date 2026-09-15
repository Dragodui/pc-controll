// Package server wires config, input backend, mDNS and the WebSocket
// handler into a service that can be started and stopped. The CLI uses
// Run; the desktop app drives New/Start/Stop directly.
package server

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/Dragodui/pc-controll/internal/config"
	"github.com/Dragodui/pc-controll/internal/discovery"
	"github.com/Dragodui/pc-controll/internal/events"
	"github.com/Dragodui/pc-controll/internal/input"
	"github.com/Dragodui/pc-controll/internal/web"
)

type Options struct {
	Name     string
	Port     int
	Password string
	Backend  input.Backend
	// Events receives runtime notifications. May be nil.
	Events events.Handler
}

type Server struct {
	opts    Options
	handler *web.Server

	mu       sync.Mutex
	http     *http.Server
	mdns     *discovery.Advertiser
	done     chan struct{}
	serveErr error
}

func New(opts Options) *Server {
	if opts.Backend == nil {
		opts.Backend = input.DefaultBackend()
	}
	return &Server{
		opts:    opts,
		handler: web.NewServer(opts.Password, opts.Backend, opts.Events),
	}
}

// Start binds the port and begins serving in the background.
// It returns an error if the port is taken; mDNS failure is reported as an event only.
func (s *Server) Start() error {
	s.mu.Lock()
	if s.http != nil {
		s.mu.Unlock()
		return errors.New("server already running")
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", s.handler.HandleWS)
	mux.HandleFunc("/health", s.handler.HandleHealth)

	httpServer := &http.Server{
		Addr:         fmt.Sprintf(":%d", s.opts.Port),
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	rawListener, err := net.Listen("tcp", httpServer.Addr)
	if err != nil {
		s.mu.Unlock()
		return fmt.Errorf("listen error: %w", err)
	}
	tcpListener, ok := rawListener.(*net.TCPListener)
	if !ok {
		rawListener.Close()
		s.mu.Unlock()
		return fmt.Errorf("listener error: not a TCP listener")
	}

	mdns, mdnsErr := discovery.StartMDNS(s.opts.Name, s.opts.Port)

	s.http = httpServer
	s.mdns = mdns
	s.done = make(chan struct{})
	s.serveErr = nil

	go func() {
		err := httpServer.Serve(noDelayListener{TCPListener: tcpListener})
		if !errors.Is(err, http.ErrServerClosed) {
			s.mu.Lock()
			s.serveErr = err
			s.mu.Unlock()
			s.opts.Events.Emit(events.Info, "", fmt.Sprintf("serve error: %v", err))
		}
		close(s.done)
	}()
	s.mu.Unlock()

	// Handlers may call back into Running()/Clients(): emit only after unlocking.
	if mdnsErr != nil {
		s.opts.Events.Emit(events.Info, "", fmt.Sprintf("mDNS disabled: %v", mdnsErr))
	} else {
		s.opts.Events.Emit(events.Info, "", fmt.Sprintf("mDNS: service registered as '%s'", s.opts.Name))
	}
	s.opts.Events.Emit(events.Started, "", fmt.Sprintf("listening on port %d, backend %s", s.opts.Port, s.opts.Backend.Name()))
	return nil
}

// Stop shuts the listener and mDNS down and waits for the serve loop to exit.
func (s *Server) Stop(ctx context.Context) error {
	s.mu.Lock()
	httpServer := s.http
	mdns := s.mdns
	done := s.done
	s.http = nil
	s.mdns = nil
	s.mu.Unlock()

	if httpServer == nil {
		return nil
	}
	mdns.Shutdown()
	err := httpServer.Shutdown(ctx)
	select {
	case <-done:
	case <-ctx.Done():
	}
	s.opts.Events.Emit(events.Stopped, "", "server stopped")
	return err
}

// Wait blocks until the serve loop exits (after Stop or on a serve error).
func (s *Server) Wait() error {
	s.mu.Lock()
	done := s.done
	s.mu.Unlock()
	if done == nil {
		return nil
	}
	<-done
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.serveErr
}

func (s *Server) Running() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.http != nil
}

func (s *Server) Clients() []web.Client  { return s.handler.Clients() }
func (s *Server) Backend() input.Backend { return s.opts.Backend }
func (s *Server) Port() int              { return s.opts.Port }

// Run is the CLI entrypoint: load config, start, block until SIGINT/SIGTERM.
func Run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	srv := New(Options{
		Name:     cfg.PCName,
		Port:     cfg.WSPort,
		Password: cfg.ServerPassword,
		Events:   logEvents,
	})
	if err := srv.Start(); err != nil {
		return err
	}
	printStartupInfo(cfg, srv.Backend().Name())

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return srv.Stop(shutdownCtx)
	case <-srv.doneChan():
		return srv.Wait()
	}
}

func (s *Server) doneChan() <-chan struct{} {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.done
}

func logEvents(e events.Event) {
	if e.Addr != "" {
		log.Printf("%s: %s", e.Addr, e.Message)
		return
	}
	log.Print(e.Message)
}

// LocalIPv4s lists non-loopback IPv4 addresses, for showing the user what to type into the phone.
func LocalIPv4s() []string {
	addrs, _ := net.InterfaceAddrs()
	var ips []string
	for _, a := range addrs {
		if ipnet, ok := a.(*net.IPNet); ok && !ipnet.IP.IsLoopback() && ipnet.IP.To4() != nil {
			ips = append(ips, ipnet.IP.String())
		}
	}
	return ips
}

func printStartupInfo(cfg config.Config, backendName string) {
	fmt.Println("------------------------------------")
	fmt.Println("Remote Server Started!")
	fmt.Printf("Port: %d\n", cfg.WSPort)
	fmt.Printf("Password: %s\n", cfg.ServerPassword)
	fmt.Printf("Input Backend: %s\n", backendName)
	fmt.Printf("Session Type: %s\n", firstNonEmpty(os.Getenv("XDG_SESSION_TYPE"), "unknown"))
	fmt.Println("Available IP Addresses:")
	for _, ip := range LocalIPv4s() {
		fmt.Printf(" > %s\n", ip)
	}
	fmt.Println("------------------------------------")
}

func firstNonEmpty(value string, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
