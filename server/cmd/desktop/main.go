// pc-control-desktop: tray application with a settings window around the
// same server core the CLI uses.
//
//	pc-control-desktop                 open the window
//	pc-control-desktop --hidden        start minimized to the tray (used by autostart)
//	pc-control-desktop --autostart on  register/unregister launch at login and exit
package main

import (
	"fmt"
	"log"
	"os"

	"github.com/Dragodui/pc-controll/internal/desktop"
)

func main() {
	hidden := false
	args := os.Args[1:]
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--hidden":
			hidden = true
		case "--autostart":
			if i+1 >= len(args) || (args[i+1] != "on" && args[i+1] != "off") {
				fmt.Fprintln(os.Stderr, "usage: --autostart on|off")
				os.Exit(2)
			}
			if err := desktop.SetAutostart(args[i+1] == "on"); err != nil {
				log.Fatal(err)
			}
			fmt.Println("launch at login:", args[i+1])
			return
		default:
			fmt.Fprintf(os.Stderr, "unknown flag %q\n", args[i])
			os.Exit(2)
		}
	}
	if err := desktop.Run(hidden); err != nil {
		log.Fatal(err)
	}
}
