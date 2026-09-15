package desktop

import (
	"os"

	"github.com/emersion/go-autostart"
)

func autostartApp() (*autostart.App, error) {
	exe, err := os.Executable()
	if err != nil {
		return nil, err
	}
	return &autostart.App{
		Name:        "pc-control",
		DisplayName: "PC Control",
		Exec:        []string{exe, "--hidden"},
	}, nil
}

func setLaunchAtLogin(enabled bool) error {
	app, err := autostartApp()
	if err != nil {
		return err
	}
	if enabled {
		return app.Enable()
	}
	if app.IsEnabled() {
		return app.Disable()
	}
	return nil
}
