package main

import (
	"log"

	"github.com/Dragodui/pc-controll/internal/server"
)

func main() {
	if err := server.Run(); err != nil {
		log.Fatal(err)
	}
}
