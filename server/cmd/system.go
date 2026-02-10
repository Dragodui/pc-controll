package main

import (
	"log"
	"os/exec"
	"runtime"
)

func handleSystemCommand(action string) {
	var cmd *exec.Cmd
	switch action {
	case "shutdown":
		if runtime.GOOS == "windows" {
			cmd = exec.Command("shutdown", "/s", "/t", "0")
		} else {
			cmd = exec.Command("shutdown", "now")
		}
	case "restart":
		if runtime.GOOS == "windows" {
			cmd = exec.Command("shutdown", "/r", "/t", "0")
		} else {
			cmd = exec.Command("reboot")
		}
	case "lock":
		if runtime.GOOS == "windows" {
			cmd = exec.Command("rundll32.exe", "user32.dll,LockWorkStation")
		} else if runtime.GOOS == "darwin" {
			cmd = exec.Command("open", "-a", "ScreenSaverEngine")
		} else {
			cmd = exec.Command("loginctl", "lock-session")
		}
	case "sleep":
		if runtime.GOOS == "windows" {
			cmd = exec.Command("rundll32.exe", "powprof.dll,SetSuspendState", "0", "1", "0")
		} else if runtime.GOOS == "darwin" {
			cmd = exec.Command("pmset", "sleepnow")
		} else {
			cmd = exec.Command("systemctl", "suspend")
		}
	}

	if cmd != nil {
		err := cmd.Run()
		if err != nil {
			log.Printf("System command error: %v", err)
		}
	}
}

func openURL(target string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":

		cmd = exec.Command("cmd", "/c", "start", target)
	case "darwin":
		cmd = exec.Command("open", target)
	default: // linux
		cmd = exec.Command("xdg-open", target)
	}

	if err := cmd.Start(); err != nil {
		log.Printf("Failed to open URL: %v", err)
	}
}
