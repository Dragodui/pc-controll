package desktop

import (
	"image/png"
	"os"
	"testing"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/test"

	"github.com/Dragodui/pc-controll/internal/appconfig"
)

// TestRenderWindow draws the settings window with the software renderer and,
// when PCC_RENDER_OUT is set, writes it as PNG. No display needed:
//
//	PCC_RENDER_OUT=/tmp/win.png go test ./internal/desktop -run TestRenderWindow
func TestRenderWindow(t *testing.T) {
	a := test.NewTempApp(t)
	a.Settings().SetTheme(appTheme{})

	u := &ui{
		app: a,
		ctl: newController(),
		cfg: appconfig.Config{Name: "MacBook Pro", Port: 1212, Password: "123456", StartServerOnLaunch: true},
	}
	u.win = a.NewWindow("PC Control")
	u.win.Resize(fyne.NewSize(880, 600))
	u.win.SetContent(u.build())
	u.refresh()

	img := u.win.Canvas().Capture()
	if img.Bounds().Dx() < 400 {
		t.Fatalf("unexpected capture size %v", img.Bounds())
	}
	if out := os.Getenv("PCC_RENDER_OUT"); out != "" {
		f, err := os.Create(out)
		if err != nil {
			t.Fatal(err)
		}
		defer f.Close()
		if err := png.Encode(f, img); err != nil {
			t.Fatal(err)
		}
	}
}
