// pc-control-desktop: tray application with a settings window around the
// same server core the CLI uses.
package main

import (
	"log"
	"os"

	"github.com/Dragodui/pc-controll/internal/desktop"
)

func main() {
	hidden := false
	for _, arg := range os.Args[1:] {
		if arg == "--hidden" {
			hidden = true
		}
	}
	if err := desktop.Run(hidden); err != nil {
		log.Fatal(err)
	}
}
