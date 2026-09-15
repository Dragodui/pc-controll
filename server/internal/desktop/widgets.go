package desktop

import (
	"image/color"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/layout"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"
)

const (
	rowHeight   = 34
	rowPadding  = 12
	groupRadius = 10
	groupGap    = 20
)

// currentPalette follows the app's light/dark setting.
func currentPalette() palette {
	return paletteFor(fyne.CurrentApp().Settings().ThemeVariant())
}

// --- switch -----------------------------------------------------------------

// toggle is a macOS-style switch: 38×22 pill with an 18px knob.
type toggle struct {
	widget.BaseWidget
	on       bool
	OnChange func(on bool)
}

func newToggle(onChange func(bool)) *toggle {
	t := &toggle{OnChange: onChange}
	t.ExtendBaseWidget(t)
	return t
}

func (t *toggle) SetOn(on bool) {
	if t.on == on {
		return
	}
	t.on = on
	t.Refresh()
}

func (t *toggle) Tapped(*fyne.PointEvent) {
	if t.OnChange != nil {
		t.OnChange(!t.on)
	}
}

func (t *toggle) MinSize() fyne.Size { return fyne.NewSize(38, 22) }

func (t *toggle) CreateRenderer() fyne.WidgetRenderer {
	track := canvas.NewRectangle(color.Transparent)
	track.CornerRadius = 11
	knob := canvas.NewCircle(color.White)
	r := &toggleRenderer{t: t, track: track, knob: knob}
	r.Refresh()
	return r
}

type toggleRenderer struct {
	t     *toggle
	track *canvas.Rectangle
	knob  *canvas.Circle
}

func (r *toggleRenderer) Layout(size fyne.Size) {
	r.track.Resize(fyne.NewSize(38, 22))
	r.track.Move(fyne.NewPos(0, (size.Height-22)/2))
	x := float32(2)
	if r.t.on {
		x = 38 - 2 - 18
	}
	r.knob.Resize(fyne.NewSize(18, 18))
	r.knob.Move(fyne.NewPos(x, (size.Height-22)/2+2))
}

func (r *toggleRenderer) MinSize() fyne.Size { return r.t.MinSize() }
func (r *toggleRenderer) Refresh() {
	p := currentPalette()
	if r.t.on {
		r.track.FillColor = accent
	} else {
		r.track.FillColor = p.hairline
	}
	r.track.Refresh()
	r.Layout(r.t.Size())
	canvas.Refresh(r.knob)
}
func (r *toggleRenderer) Objects() []fyne.CanvasObject { return []fyne.CanvasObject{r.track, r.knob} }
func (r *toggleRenderer) Destroy()                     {}

// --- text helpers -------------------------------------------------------------

func titleText(s string) *canvas.Text {
	t := canvas.NewText(s, currentPalette().text)
	t.TextSize = 15
	t.TextStyle = fyne.TextStyle{Bold: true}
	return t
}

func secondaryText(s string) *canvas.Text {
	t := canvas.NewText(s, currentPalette().secondary)
	t.TextSize = 11
	return t
}

func sectionHeader(s string) fyne.CanvasObject {
	t := secondaryText(uppercase(s))
	// Design: 20px above, 6px below, 4px left inset.
	return container.New(layout.NewCustomPaddedLayout(groupGap, 6, 4, 0), t)
}

func bodyText(s string) *canvas.Text {
	t := canvas.NewText(s, currentPalette().text)
	t.TextSize = 13
	return t
}

func monoText(s string) *canvas.Text {
	t := bodyText(s)
	t.TextStyle = fyne.TextStyle{Monospace: true}
	return t
}

func uppercase(s string) string {
	b := []rune(s)
	for i, c := range b {
		if c >= 'a' && c <= 'z' {
			b[i] = c - 'a' + 'A'
		}
	}
	return string(b)
}

// --- grouped rows -------------------------------------------------------------

// row is "label left, control right", rowHeight tall, rowPadding inset.
func row(label string, right fyne.CanvasObject) fyne.CanvasObject {
	l := bodyText(label)
	inner := container.NewBorder(nil, nil, l, right)
	return container.New(&fixedHeight{h: rowHeight, pad: rowPadding}, inner)
}

// rowText is a row with secondary text only (empty states).
func rowText(text string) fyne.CanvasObject {
	t := bodyText(text)
	t.Color = currentPalette().secondary
	return container.New(&fixedHeight{h: rowHeight, pad: rowPadding}, container.NewBorder(nil, nil, t, nil))
}

// group draws rows on a rounded surface with hairlines between them.
func group(rows ...fyne.CanvasObject) fyne.CanvasObject {
	p := currentPalette()
	bg := canvas.NewRectangle(p.group)
	bg.CornerRadius = groupRadius
	items := make([]fyne.CanvasObject, 0, len(rows)*2)
	for i, r := range rows {
		if i > 0 {
			line := canvas.NewRectangle(p.hairline)
			line.SetMinSize(fyne.NewSize(0, 1))
			items = append(items, container.New(layout.NewCustomPaddedLayout(0, 0, rowPadding, 0), line))
		}
		items = append(items, r)
	}
	return container.NewStack(bg, container.NewVBox(items...))
}

// fixedHeight centers one child vertically in a fixed-height, side-padded box.
type fixedHeight struct {
	h, pad float32
}

func (f *fixedHeight) MinSize(objects []fyne.CanvasObject) fyne.Size {
	w := float32(0)
	for _, o := range objects {
		w = fyne.Max(w, o.MinSize().Width)
	}
	h := f.h
	for _, o := range objects {
		h = fyne.Max(h, o.MinSize().Height)
	}
	return fyne.NewSize(w+2*f.pad, h)
}

func (f *fixedHeight) Layout(objects []fyne.CanvasObject, size fyne.Size) {
	for _, o := range objects {
		h := fyne.Min(o.MinSize().Height, size.Height)
		o.Resize(fyne.NewSize(size.Width-2*f.pad, h))
		o.Move(fyne.NewPos(f.pad, (size.Height-h)/2))
	}
}

// --- controls sized for rows ------------------------------------------------------

// inlineEntry is a right-aligned text field that fits inside a row.
func inlineEntry(width float32, password bool) (*widget.Entry, fyne.CanvasObject) {
	var e *widget.Entry
	if password {
		e = widget.NewPasswordEntry()
	} else {
		e = widget.NewEntry()
	}
	e.TextStyle = fyne.TextStyle{Monospace: password}
	return e, container.New(&fixedWidth{w: width}, e)
}

// fixedWidth gives its child a fixed width and the child's own min height.
type fixedWidth struct{ w float32 }

func (f *fixedWidth) MinSize(objects []fyne.CanvasObject) fyne.Size {
	h := float32(0)
	for _, o := range objects {
		h = fyne.Max(h, o.MinSize().Height)
	}
	return fyne.NewSize(f.w, h)
}

func (f *fixedWidth) Layout(objects []fyne.CanvasObject, size fyne.Size) {
	for _, o := range objects {
		o.Resize(fyne.NewSize(f.w, size.Height))
		o.Move(fyne.NewPos(0, 0))
	}
}

func iconButton(icon fyne.Resource, tapped func()) *widget.Button {
	b := widget.NewButtonWithIcon("", icon, tapped)
	b.Importance = widget.LowImportance
	return b
}

func linkButton(text string, tapped func()) fyne.CanvasObject {
	l := widget.NewHyperlink(text, nil)
	l.OnTapped = tapped
	l.TextStyle = fyne.TextStyle{}
	l.Alignment = fyne.TextAlignLeading
	return l
}

var _ = theme.VisibilityIcon
