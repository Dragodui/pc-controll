// Package desktop is the tray + settings window around the server core.
package desktop

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	fynedesktop "fyne.io/fyne/v2/driver/desktop"
	"fyne.io/fyne/v2/widget"

	"github.com/Dragodui/pc-controll/internal/appconfig"
	"github.com/Dragodui/pc-controll/internal/desktop/assets"
	"github.com/Dragodui/pc-controll/internal/server"
)

const appID = "com.aksandr.pccontrol"

type ui struct {
	app  fyne.App
	win  fyne.Window
	ctl  *controller
	cfg  appconfig.Config
	tray fynedesktop.App

	name          *widget.Entry
	port          *widget.Entry
	password      *widget.Entry
	startOnLaunch *widget.Check
	launchAtLogin *widget.Check
	toggle        *widget.Button
	status        *widget.Label
	addresses     *widget.Label
	clients       *widget.Label
	log           *widget.Label
	logScroll     *container.Scroll
}

// Run starts the desktop app. hidden=true starts minimized to the tray.
func Run(hidden bool) error {
	cfg, err := appconfig.Load()
	if err != nil {
		return err
	}

	u := &ui{
		app: app.NewWithID(appID),
		ctl: newController(),
		cfg: cfg,
	}
	u.app.SetIcon(assets.Icon)
	u.win = u.app.NewWindow("PC Control")
	u.win.SetIcon(assets.Icon)
	u.win.Resize(fyne.NewSize(460, 560))
	u.win.SetContent(u.build())
	// Closing the window keeps the server running in the tray; Quit is in the tray menu.
	u.win.SetCloseIntercept(u.win.Hide)

	if tray, ok := u.app.(fynedesktop.App); ok {
		u.tray = tray
		tray.SetSystemTrayIcon(assets.Icon)
		u.refreshTray()
	}

	u.ctl.onChange = func() { fyne.Do(u.refresh) }
	u.refresh()

	if cfg.StartServerOnLaunch {
		u.startServer()
	}
	if !hidden || u.tray == nil {
		u.win.Show()
	}
	u.app.Run()
	u.ctl.stop()
	return nil
}

func (u *ui) build() fyne.CanvasObject {
	u.name = widget.NewEntry()
	u.name.SetText(u.cfg.Name)
	u.port = widget.NewEntry()
	u.port.SetText(strconv.Itoa(u.cfg.Port))
	u.password = widget.NewPasswordEntry()
	u.password.SetText(u.cfg.Password)

	u.startOnLaunch = widget.NewCheck("Start server when the app opens", func(v bool) {
		u.cfg.StartServerOnLaunch = v
		u.save()
	})
	u.startOnLaunch.SetChecked(u.cfg.StartServerOnLaunch)

	u.launchAtLogin = widget.NewCheck("Launch at login (minimized to tray)", func(v bool) {
		if err := setLaunchAtLogin(v); err != nil {
			dialog.ShowError(fmt.Errorf("autostart: %w", err), u.win)
			u.launchAtLogin.SetChecked(!v)
			return
		}
		u.cfg.LaunchAtLogin = v
		u.save()
	})
	u.launchAtLogin.SetChecked(u.cfg.LaunchAtLogin)

	u.toggle = widget.NewButton("Start", u.onToggle)
	u.toggle.Importance = widget.HighImportance
	saveButton := widget.NewButton("Save", func() {
		if u.applyFields() {
			u.save()
		}
	})

	u.status = widget.NewLabel("")
	u.status.Wrapping = fyne.TextWrapWord
	u.addresses = widget.NewLabel("")
	u.addresses.TextStyle = fyne.TextStyle{Monospace: true}
	u.clients = widget.NewLabel("")
	u.log = widget.NewLabel("")
	u.log.TextStyle = fyne.TextStyle{Monospace: true}
	u.log.Wrapping = fyne.TextWrapWord
	u.logScroll = container.NewVScroll(u.log)
	u.logScroll.SetMinSize(fyne.NewSize(0, 160))

	form := widget.NewForm(
		widget.NewFormItem("PC name", u.name),
		widget.NewFormItem("Port", u.port),
		widget.NewFormItem("Password", u.password),
	)

	return container.NewVBox(
		form,
		u.startOnLaunch,
		u.launchAtLogin,
		container.NewGridWithColumns(2, u.toggle, saveButton),
		u.status,
		widget.NewSeparator(),
		widget.NewLabelWithStyle("Connect from the phone", fyne.TextAlignLeading, fyne.TextStyle{Bold: true}),
		u.addresses,
		widget.NewLabelWithStyle("Connected phones", fyne.TextAlignLeading, fyne.TextStyle{Bold: true}),
		u.clients,
		widget.NewLabelWithStyle("Log", fyne.TextAlignLeading, fyne.TextStyle{Bold: true}),
		u.logScroll,
	)
}

// applyFields validates the entries into cfg. Shows a dialog and returns false on bad input.
func (u *ui) applyFields() bool {
	port, err := strconv.Atoi(strings.TrimSpace(u.port.Text))
	if err != nil {
		dialog.ShowError(fmt.Errorf("port must be a number"), u.win)
		return false
	}
	next := u.cfg
	next.Name = strings.TrimSpace(u.name.Text)
	next.Port = port
	next.Password = u.password.Text
	if err := next.Validate(); err != nil {
		dialog.ShowError(err, u.win)
		return false
	}
	u.cfg = next
	return true
}

func (u *ui) save() {
	if err := u.cfg.Save(); err != nil {
		dialog.ShowError(fmt.Errorf("save settings: %w", err), u.win)
	}
}

func (u *ui) onToggle() {
	if u.ctl.running() {
		u.ctl.stop()
		u.refresh()
		return
	}
	if !u.applyFields() {
		return
	}
	u.save()
	u.startServer()
}

func (u *ui) startServer() {
	if err := u.ctl.start(u.cfg); err != nil {
		dialog.ShowError(err, u.win)
	}
	u.refresh()
}

// refresh redraws state-dependent widgets. Must run on the Fyne thread.
func (u *ui) refresh() {
	running := u.ctl.running()
	if running {
		u.toggle.SetText("Stop")
		u.toggle.Importance = widget.DangerImportance
	} else {
		u.toggle.SetText("Start")
		u.toggle.Importance = widget.HighImportance
	}
	u.toggle.Refresh()
	for _, e := range []*widget.Entry{u.name, u.port, u.password} {
		if running {
			e.Disable()
		} else {
			e.Enable()
		}
	}

	ok, backendText := u.ctl.backendStatus()
	switch {
	case !ok:
		u.status.SetText("⚠ " + backendText)
		u.status.Importance = widget.WarningImportance
	case running:
		u.status.SetText("Running on port " + strconv.Itoa(u.cfg.Port) + " · " + backendText)
		u.status.Importance = widget.SuccessImportance
	default:
		u.status.SetText("Stopped · " + backendText)
		u.status.Importance = widget.MediumImportance
	}
	u.status.Refresh()

	var addrs []string
	for _, ip := range server.LocalIPv4s() {
		addrs = append(addrs, fmt.Sprintf("%s:%d", ip, u.cfg.Port))
	}
	if len(addrs) == 0 {
		addrs = []string{"no network"}
	}
	u.addresses.SetText(strings.Join(addrs, "\n") + "\nPassword: " + u.cfg.Password)

	clients := u.ctl.clients()
	if len(clients) == 0 {
		u.clients.SetText("none")
	} else {
		var lines []string
		for _, c := range clients {
			lines = append(lines, fmt.Sprintf("%s  since %s", c.Addr, c.Since.Format(time.Kitchen)))
		}
		u.clients.SetText(strings.Join(lines, "\n"))
	}

	u.log.SetText(u.ctl.logText())
	u.logScroll.ScrollToBottom()
	u.refreshTray()
}

func (u *ui) refreshTray() {
	if u.tray == nil {
		return
	}
	toggleLabel := "Start server"
	if u.ctl.running() {
		toggleLabel = "Stop server"
	}
	u.tray.SetSystemTrayMenu(fyne.NewMenu("PC Control",
		fyne.NewMenuItem("Open", func() { u.win.Show(); u.win.RequestFocus() }),
		fyne.NewMenuItem(toggleLabel, u.onToggle),
		fyne.NewMenuItemSeparator(),
		fyne.NewMenuItem("Quit", u.app.Quit),
	))
}
