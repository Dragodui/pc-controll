// Package desktop is the tray + settings window around the server core.
package desktop

import (
	"fmt"
	"strconv"
	"strings"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	fynedesktop "fyne.io/fyne/v2/driver/desktop"
	"fyne.io/fyne/v2/layout"
	"fyne.io/fyne/v2/theme"
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

	power    *toggle
	subtitle *canvas.Text

	address        *canvas.Text
	sharedPassword *canvas.Text
	revealed       bool

	name          *widget.Entry
	port          *widget.Entry
	password      *widget.Entry
	startOnLaunch *toggle
	launchAtLogin *toggle

	devices *fyne.Container
	// runningCfg is what the server was started with; differs from cfg after edits.
	runningCfg appconfig.Config

	log        *widget.Label
	logBox     fyne.CanvasObject
	logVisible bool
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
	u.app.Settings().SetTheme(appTheme{})
	u.app.SetIcon(assets.Icon)
	u.win = u.app.NewWindow("PC Control")
	u.win.SetIcon(assets.Icon)
	u.win.Resize(fyne.NewSize(420, 520))
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
	// Header: title + status line left, power switch right.
	u.power = newToggle(func(on bool) {
		if on {
			if !u.applyFields() {
				u.power.SetOn(false)
				return
			}
			u.save()
			u.startServer()
		} else {
			u.ctl.stop()
			u.refresh()
		}
	})
	u.subtitle = secondaryText("")
	header := container.NewBorder(nil, nil, nil,
		container.New(layout.NewCustomPaddedLayout(1, 0, 0, 0), u.power),
		container.NewVBox(titleText("PC Control"), container.New(layout.NewCustomPaddedLayout(3, 0, 0, 0), u.subtitle)),
	)

	// Connect from your phone.
	u.address = monoText("")
	u.sharedPassword = monoText("")
	eye := iconButton(theme.VisibilityIcon(), func() {
		u.revealed = !u.revealed
		u.refresh()
	})
	connect := group(
		row("Address", u.address),
		row("Password", container.NewHBox(u.sharedPassword, eye)),
	)

	// Settings.
	var nameBox, portBox, passBox fyne.CanvasObject
	u.name, nameBox = inlineEntry(160, false)
	u.port, portBox = inlineEntry(70, false)
	u.password, passBox = inlineEntry(160, true)
	u.name.SetText(u.cfg.Name)
	u.port.SetText(strconv.Itoa(u.cfg.Port))
	u.password.SetText(u.cfg.Password)
	for _, e := range []*widget.Entry{u.name, u.port, u.password} {
		e.OnChanged = func(string) { u.saveIfValid() }
	}

	u.startOnLaunch = newToggle(func(v bool) {
		u.cfg.StartServerOnLaunch = v
		u.startOnLaunch.SetOn(v)
		u.save()
	})
	u.startOnLaunch.SetOn(u.cfg.StartServerOnLaunch)
	u.launchAtLogin = newToggle(func(v bool) {
		if err := setLaunchAtLogin(v); err != nil {
			dialog.ShowError(fmt.Errorf("autostart: %w", err), u.win)
			return
		}
		u.cfg.LaunchAtLogin = v
		u.launchAtLogin.SetOn(v)
		u.save()
	})
	u.launchAtLogin.SetOn(u.cfg.LaunchAtLogin)

	settings := group(
		row("Name", nameBox),
		row("Port", portBox),
		row("Password", passBox),
		row("Start server when app opens", u.startOnLaunch),
		row("Open at login", u.launchAtLogin),
	)

	// Connected devices: rebuilt on refresh.
	u.devices = container.NewStack()

	// Log, collapsed by default.
	u.log = widget.NewLabel("")
	u.log.TextStyle = fyne.TextStyle{Monospace: true}
	u.log.Wrapping = fyne.TextWrapWord
	logScroll := container.NewVScroll(u.log)
	logScroll.SetMinSize(fyne.NewSize(0, 120))
	u.logBox = logScroll
	u.logBox.Hide()
	showLog := linkButton("Show log", func() {
		u.logVisible = !u.logVisible
		if u.logVisible {
			u.logBox.Show()
		} else {
			u.logBox.Hide()
		}
	})

	content := container.NewVBox(
		header,
		sectionHeader("Connect from your phone"), connect,
		sectionHeader("Settings"), settings,
		sectionHeader("Connected devices"), u.devices,
		container.New(layout.NewCustomPaddedLayout(groupGap, 0, 0, 0), showLog),
		u.logBox,
	)
	padded := container.New(layout.NewCustomPaddedLayout(14, 16, 16, 16), content)
	return container.NewVScroll(padded)
}

// applyFields validates the entries into cfg. Shows a dialog and returns false on bad input.
func (u *ui) applyFields() bool {
	next, err := u.fieldsConfig()
	if err != nil {
		dialog.ShowError(err, u.win)
		return false
	}
	u.cfg = next
	return true
}

func (u *ui) fieldsConfig() (appconfig.Config, error) {
	port, err := strconv.Atoi(strings.TrimSpace(u.port.Text))
	if err != nil {
		return appconfig.Config{}, fmt.Errorf("port must be a number")
	}
	next := u.cfg
	next.Name = strings.TrimSpace(u.name.Text)
	next.Port = port
	next.Password = u.password.Text
	return next, next.Validate()
}

// saveIfValid persists edits as they are typed; invalid intermediate states are ignored.
func (u *ui) saveIfValid() {
	next, err := u.fieldsConfig()
	if err != nil {
		return
	}
	u.cfg = next
	u.save()
	u.refresh()
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
	} else {
		u.runningCfg = u.cfg
	}
	u.refresh()
}

func (u *ui) needsRestart() bool {
	return u.cfg.Name != u.runningCfg.Name || u.cfg.Port != u.runningCfg.Port || u.cfg.Password != u.runningCfg.Password
}

// refresh redraws state-dependent widgets. Must run on the Fyne thread.
func (u *ui) refresh() {
	running := u.ctl.running()
	u.power.SetOn(running)

	ok, backendText := u.ctl.backendStatus()
	switch {
	case !ok:
		u.subtitle.Text = backendText
	case running && u.needsRestart():
		u.subtitle.Text = fmt.Sprintf("Running · port %d · restart to apply changes", u.runningCfg.Port)
	case running:
		u.subtitle.Text = fmt.Sprintf("Running · port %d", u.runningCfg.Port)
	default:
		u.subtitle.Text = "Stopped"
	}
	u.subtitle.Refresh()

	u.refreshShared()

	clients := u.ctl.clients()
	rows := make([]fyne.CanvasObject, 0, len(clients))
	for _, c := range clients {
		rows = append(rows, row(c.Addr, secondaryText("since "+c.Since.Format("15:04"))))
	}
	if len(rows) == 0 {
		rows = append(rows, rowText("No devices connected"))
	}
	u.devices.Objects = []fyne.CanvasObject{group(rows...)}
	u.devices.Refresh()

	u.log.SetText(u.ctl.logText())
	// SetContent shows the whole tree once; re-apply the collapsed state.
	if u.logVisible {
		u.logBox.Show()
	} else {
		u.logBox.Hide()
	}
	u.refreshTray()
}

func (u *ui) refreshShared() {
	u.address.Text = fmt.Sprintf("%s:%d", server.PrimaryIPv4(), u.cfg.Port)
	u.address.Refresh()
	if u.revealed {
		u.sharedPassword.Text = u.cfg.Password
	} else {
		u.sharedPassword.Text = strings.Repeat("•", len([]rune(u.cfg.Password)))
	}
	u.sharedPassword.Refresh()
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
