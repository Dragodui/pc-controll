package desktop

import (
	"net"
	"os"
	"path/filepath"
	"runtime"
	"time"
)

// Single-instance guard. The running app listens on a local socket; a second
// launch (menu shortcut, autostart race) asks it to show its window and exits.

const showCommand = "show\n"

func instanceAddr() (network, addr string) {
	// Test hook: run a second, independent instance.
	if p := os.Getenv("PC_CONTROL_INSTANCE_SOCKET"); p != "" {
		return "unix", p
	}
	if runtime.GOOS == "windows" {
		return "tcp", "127.0.0.1:47812"
	}
	dir := os.Getenv("XDG_RUNTIME_DIR")
	if dir == "" {
		dir = os.TempDir()
	}
	return "unix", filepath.Join(dir, "pc-control-desktop.sock")
}

// askRunningInstanceToShow returns true if another instance accepted the request.
func askRunningInstanceToShow() bool {
	network, addr := instanceAddr()
	conn, err := net.DialTimeout(network, addr, 300*time.Millisecond)
	if err != nil {
		return false
	}
	defer conn.Close()
	_, err = conn.Write([]byte(showCommand))
	return err == nil
}

// listenForShowRequests serves the socket until the process exits. onShow runs
// on the caller's goroutine choice; the UI wraps it in fyne.Do.
func listenForShowRequests(onShow func()) (func(), error) {
	network, addr := instanceAddr()
	if network == "unix" {
		os.Remove(addr) // stale socket from a crashed instance
	}
	ln, err := net.Listen(network, addr)
	if err != nil {
		return nil, err
	}
	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			buf := make([]byte, 16)
			n, _ := conn.Read(buf)
			conn.Close()
			if string(buf[:n]) == showCommand {
				onShow()
			}
		}
	}()
	return func() {
		ln.Close()
		if network == "unix" {
			os.Remove(addr)
		}
	}, nil
}
