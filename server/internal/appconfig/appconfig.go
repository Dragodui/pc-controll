// Package appconfig stores desktop app settings as JSON in the OS config
// directory. The CLI keeps using .env; the desktop app imports it once.
package appconfig

import (
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"strconv"

	"github.com/Dragodui/pc-controll/internal/config"
)

const (
	appDirName  = "pc-control"
	fileName    = "config.json"
	DefaultPort = 1212
)

type Config struct {
	Name     string `json:"name"`
	Port     int    `json:"port"`
	Password string `json:"password"`
	// LaunchAtLogin registers the app with the OS autostart mechanism.
	LaunchAtLogin bool `json:"launch_at_login"`
	// StartServerOnLaunch starts listening as soon as the app opens.
	StartServerOnLaunch bool `json:"start_server_on_launch"`
}

func Dir() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(base, appDirName), nil
}

func Path() (string, error) {
	dir, err := Dir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, fileName), nil
}

// Load reads the config file. When it does not exist, it builds defaults,
// importing a .env next to the executable if there is one, and saves them.
func Load() (Config, error) {
	path, err := Path()
	if err != nil {
		return Config{}, err
	}

	data, err := os.ReadFile(path)
	if err == nil {
		var cfg Config
		if err := json.Unmarshal(data, &cfg); err != nil {
			return Config{}, fmt.Errorf("parse %s: %w", path, err)
		}
		return cfg.withDefaults(), nil
	}
	if !errors.Is(err, os.ErrNotExist) {
		return Config{}, err
	}

	cfg := fromEnv().withDefaults()
	if err := cfg.Save(); err != nil {
		return cfg, err
	}
	return cfg, nil
}

func (c Config) Save() error {
	path, err := Path()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	// 0600: the file holds the password.
	return os.WriteFile(path, data, 0o600)
}

func (c Config) Validate() error {
	if c.Port < 1 || c.Port > 65535 {
		return fmt.Errorf("port must be between 1 and 65535")
	}
	if c.Password == "" {
		return fmt.Errorf("password must not be empty")
	}
	if c.Name == "" {
		return fmt.Errorf("name must not be empty")
	}
	return nil
}

func (c Config) withDefaults() Config {
	if c.Name == "" {
		if host, err := os.Hostname(); err == nil && host != "" {
			c.Name = host
		} else {
			c.Name = "Remote PC"
		}
	}
	if c.Port == 0 {
		c.Port = DefaultPort
	}
	if c.Password == "" {
		c.Password = randomPIN()
	}
	return c
}

// fromEnv picks up WS_PORT / SERVER_PASSWORD / PC_NAME from the environment
// or a legacy .env, so users of the CLI keep their settings.
func fromEnv() Config {
	config.LoadDotEnv()
	cfg := Config{
		Name:                os.Getenv("PC_NAME"),
		Password:            os.Getenv("SERVER_PASSWORD"),
		StartServerOnLaunch: true,
	}
	if port, err := strconv.Atoi(os.Getenv("WS_PORT")); err == nil {
		cfg.Port = port
	}
	return cfg
}

func randomPIN() string {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "123456"
	}
	return fmt.Sprintf("%06d", n.Int64())
}
