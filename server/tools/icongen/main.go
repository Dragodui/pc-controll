// icongen draws the project icon: a white cursor arrow on a blue tile.
// The same source feeds the desktop tray icon and the Android app icons,
// so they stay identical.
//
//	go run ./tools/icongen <out.png> <size> <mode>
//
// Modes:
//
//	tile        rounded blue tile with arrow (app icon, tray)
//	foreground  white arrow on transparent, shrunk into the adaptive-icon safe zone
//	square      full-bleed blue with arrow (splash)
package main

import (
	"fmt"
	"image"
	"image/color"
	"image/png"
	"os"
	"strconv"
)

var (
	blue  = color.NRGBA{0x2b, 0x6c, 0xf0, 0xff}
	white = color.NRGBA{0xff, 0xff, 0xff, 0xff}
)

// Standard arrow cursor polygon in a 0..1 box.
var arrow = [][2]float64{{0.30, 0.22}, {0.30, 0.74}, {0.43, 0.62}, {0.51, 0.80}, {0.59, 0.76}, {0.51, 0.59}, {0.68, 0.59}}

func inRoundedRect(x, y, r float64) bool {
	cx, cy := x, y
	if x < r {
		cx = r
	} else if x > 1-r {
		cx = 1 - r
	}
	if y < r {
		cy = r
	} else if y > 1-r {
		cy = 1 - r
	}
	return (x-cx)*(x-cx)+(y-cy)*(y-cy) <= r*r
}

func inPolygon(x, y float64, poly [][2]float64) bool {
	inside := false
	j := len(poly) - 1
	for i := range poly {
		xi, yi := poly[i][0], poly[i][1]
		xj, yj := poly[j][0], poly[j][1]
		if (yi > y) != (yj > y) && x < (xj-xi)*(y-yi)/(yj-yi)+xi {
			inside = !inside
		}
		j = i
	}
	return inside
}

func mix(a, b color.NRGBA, t float64) color.NRGBA {
	return color.NRGBA{
		R: uint8(float64(a.R)*(1-t) + float64(b.R)*t),
		G: uint8(float64(a.G)*(1-t) + float64(b.G)*t),
		B: uint8(float64(a.B)*(1-t) + float64(b.B)*t),
		A: 0xff,
	}
}

func main() {
	if len(os.Args) != 4 {
		fmt.Fprintln(os.Stderr, "usage: icongen <out.png> <size> <tile|foreground|square>")
		os.Exit(2)
	}
	n, err := strconv.Atoi(os.Args[2])
	if err != nil || n <= 0 {
		fmt.Fprintln(os.Stderr, "size must be a positive integer")
		os.Exit(2)
	}
	mode := os.Args[3]

	// Adaptive icons get masked to roughly the central 66%; keep the arrow inside that.
	scale, offset := 1.0, 0.0
	if mode == "foreground" {
		scale, offset = 0.6, 0.2
	}

	const ss = 4 // supersampling per axis
	img := image.NewNRGBA(image.Rect(0, 0, n, n))
	for y := 0; y < n; y++ {
		for x := 0; x < n; x++ {
			var tile, arrowHits float64
			for sy := 0; sy < ss; sy++ {
				for sx := 0; sx < ss; sx++ {
					fx := (float64(x) + (float64(sx)+0.5)/ss) / float64(n)
					fy := (float64(y) + (float64(sy)+0.5)/ss) / float64(n)
					if mode == "tile" && !inRoundedRect(fx, fy, 0.22) {
						continue
					}
					tile++
					if inPolygon((fx-offset)/scale, (fy-offset)/scale, arrow) {
						arrowHits++
					}
				}
			}
			samples := float64(ss * ss)
			switch {
			case mode == "foreground":
				if arrowHits > 0 {
					c := white
					c.A = uint8(255 * arrowHits / samples)
					img.Set(x, y, c)
				}
			case tile > 0:
				c := mix(blue, white, arrowHits/tile)
				c.A = uint8(255 * tile / samples)
				img.Set(x, y, c)
			}
		}
	}

	f, err := os.Create(os.Args[1])
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	defer f.Close()
	if err := png.Encode(f, img); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
