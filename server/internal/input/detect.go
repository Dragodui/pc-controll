package input

import (
	"log"
	"os"
	"os/exec"
	"runtime"
	"strings"
)

func DetectBackend() Backend {
	forced := strings.ToLower(strings.TrimSpace(os.Getenv("INPUT_BACKEND")))
	switch forced {
	case "robotgo":
		log.Printf("Input backend forced via INPUT_BACKEND=robotgo")
		return RobotBackend{}
	case "wayland", "wayland-cli":
		return newWaylandBackend()
	}

	if isWaylandSession() {
		return newWaylandBackend()
	}

	return RobotBackend{}
}

func isWaylandSession() bool {
	if runtime.GOOS != "linux" {
		return false
	}
	if strings.EqualFold(os.Getenv("XDG_SESSION_TYPE"), "wayland") {
		return true
	}
	return os.Getenv("WAYLAND_DISPLAY") != ""
}

func commandExists(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}

func newWaylandBackend() Backend {
	if !commandExists("ydotool") {
		log.Printf("Wayland session detected, but 'ydotool' is not installed. Falling back to robotgo.")
		return RobotBackend{}
	}

	useWlrctl := commandExists("wlrctl")
	if !useWlrctl {
		log.Printf("Wayland session detected without 'wlrctl'. Pointer scroll will be unavailable; move/click will use ydotool.")
	}

	useWtype := commandExists("wtype")
	if !useWtype {
		log.Printf("Wayland session detected without 'wtype'. Text typing will use ydotool type.")
	}

	return WaylandBackend{
		UseWlrctl: useWlrctl,
		UseWtype:  useWtype,
	}
}
