package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	ServerPassword string
	PCName         string
	WSPort         int
}

func Load() (Config, error) {
	cfg := Config{
		ServerPassword: os.Getenv("SERVER_PASSWORD"),
		PCName:         os.Getenv("PC_NAME"),
	}

	if cfg.PCName == "" {
		cfg.PCName = "Remote PC"
	}
	if cfg.ServerPassword == "" {
		return Config{}, fmt.Errorf("incorrect env params: SERVER_PASSWORD is required")
	}

	wsPortEnv := os.Getenv("WS_PORT")
	if wsPortEnv == "" {
		return Config{}, fmt.Errorf("incorrect env params: WS_PORT is required")
	}

	wsPort, err := strconv.Atoi(wsPortEnv)
	if err != nil {
		return Config{}, fmt.Errorf("incorrect ws port: %w", err)
	}
	cfg.WSPort = wsPort

	return cfg, nil
}
