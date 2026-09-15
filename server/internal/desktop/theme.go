package desktop

import (
	"image/color"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/theme"
)

// Palette from the design: macOS System Settings look, one accent color.
var (
	accent = color.NRGBA{0x2B, 0x6C, 0xF0, 0xFF}

	lightWindow    = color.NRGBA{0xF5, 0xF5, 0xF7, 0xFF}
	lightGroup     = color.NRGBA{0xFF, 0xFF, 0xFF, 0xFF}
	lightHairline  = color.NRGBA{0xE5, 0xE5, 0xEA, 0xFF}
	lightText      = color.NRGBA{0x1D, 0x1D, 0x1F, 0xFF}
	lightSecondary = color.NRGBA{0x6E, 0x6E, 0x73, 0xFF}

	darkWindow    = color.NRGBA{0x1E, 0x1E, 0x1E, 0xFF}
	darkGroup     = color.NRGBA{0x2A, 0x2A, 0x2A, 0xFF}
	darkHairline  = color.NRGBA{0x3A, 0x3A, 0x3C, 0xFF}
	darkText      = color.NRGBA{0xF5, 0xF5, 0xF7, 0xFF}
	darkSecondary = color.NRGBA{0x98, 0x98, 0x9D, 0xFF}
)

type palette struct {
	window, group, hairline, text, secondary color.Color
}

func paletteFor(variant fyne.ThemeVariant) palette {
	if variant == theme.VariantDark {
		return palette{darkWindow, darkGroup, darkHairline, darkText, darkSecondary}
	}
	return palette{lightWindow, lightGroup, lightHairline, lightText, lightSecondary}
}

// appTheme maps the palette onto Fyne's theme slots and tightens the metrics.
type appTheme struct{}

var _ fyne.Theme = appTheme{}

func (appTheme) Color(name fyne.ThemeColorName, variant fyne.ThemeVariant) color.Color {
	p := paletteFor(variant)
	switch name {
	case theme.ColorNameBackground, theme.ColorNameOverlayBackground, theme.ColorNameMenuBackground:
		return p.window
	case theme.ColorNameInputBackground:
		return p.group
	case theme.ColorNameInputBorder, theme.ColorNameSeparator:
		return p.hairline
	case theme.ColorNameForeground:
		return p.text
	case theme.ColorNamePlaceHolder, theme.ColorNameDisabled:
		return p.secondary
	case theme.ColorNamePrimary, theme.ColorNameFocus, theme.ColorNameHyperlink:
		return accent
	case theme.ColorNameButton:
		return p.group
	case theme.ColorNameHover:
		return color.NRGBA{0x80, 0x80, 0x80, 0x18}
	case theme.ColorNamePressed:
		return color.NRGBA{0x80, 0x80, 0x80, 0x30}
	case theme.ColorNameShadow:
		return color.Transparent
	}
	return theme.DefaultTheme().Color(name, variant)
}

func (appTheme) Font(style fyne.TextStyle) fyne.Resource { return theme.DefaultTheme().Font(style) }
func (appTheme) Icon(name fyne.ThemeIconName) fyne.Resource {
	return theme.DefaultTheme().Icon(name)
}

func (appTheme) Size(name fyne.ThemeSizeName) float32 {
	switch name {
	case theme.SizeNameText:
		return 13
	case theme.SizeNameCaptionText:
		return 11
	case theme.SizeNameSubHeadingText:
		return 15
	case theme.SizeNameHeadingText:
		return 15
	case theme.SizeNamePadding:
		return 4
	case theme.SizeNameInnerPadding:
		return 6
	case theme.SizeNameInputBorder:
		return 1
	case theme.SizeNameInputRadius:
		return 6
	case theme.SizeNameSelectionRadius:
		return 4
	case theme.SizeNameScrollBar:
		return 8
	case theme.SizeNameScrollBarSmall:
		return 3
	}
	return theme.DefaultTheme().Size(name)
}
