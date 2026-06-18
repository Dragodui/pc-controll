package input

import (
	"log"
	"os"
	"strings"
)

func DetectBackend() Backend {
	forced := strings.ToLower(strings.TrimSpace(os.Getenv("INPUT_BACKEND")))
	switch forced {
	case "":
		configureCBackend("c-auto")
		backend, err := NewCBackend()
		if err != nil {
			return UnavailableBackend{BackendName: "pcinput", Err: errBackendRemoved("no native input backend available; build with -tags pcinput and install required OS permissions")}
		}
		return backend
	case "c", "c-auto", "c-windows", "c-wayland", "c-linux-uinput", "c-macos":
		configureCBackend(forced)
		backend, err := NewCBackend()
		if err != nil {
			log.Printf("Input backend forced via INPUT_BACKEND=%s, but pcinput is unavailable: %v", forced, err)
			return UnavailableBackend{BackendName: "pcinput-" + forced, Err: err}
		}
		log.Printf("Input backend forced via INPUT_BACKEND=%s", forced)
		return backend
	default:
		return UnavailableBackend{BackendName: "input", Err: errBackendRemoved("unknown INPUT_BACKEND; supported values are c, c-auto, c-windows, c-wayland, c-linux-uinput, c-macos")}
	}
}
