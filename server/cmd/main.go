package main

import (
	"log"

	"github.com/Dragodui/pc-controll/internal/app"
)

func main() {
	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
