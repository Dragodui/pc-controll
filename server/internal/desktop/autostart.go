package desktop

import (
	"os"

	"github.com/Dragodui/pc-controll/internal/appconfig"
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

// SetAutostart registers or removes launch-at-login and records it in the
// config, so the checkbox in the window matches. Used by the --autostart flag.
func SetAutostart(enabled bool) error {
	cfg, err := appconfig.Load()
	if err != nil {
		return err
	}
	if err := setLaunchAtLogin(enabled); err != nil {
		return err
	}
	cfg.LaunchAtLogin = enabled
	return cfg.Save()
}
