package assets

import (
	_ "embed"

	"fyne.io/fyne/v2"
)

//go:embed icon.png
var iconPNG []byte

var Icon = fyne.NewStaticResource("icon.png", iconPNG)
