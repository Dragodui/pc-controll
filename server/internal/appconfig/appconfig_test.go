package appconfig

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadCreatesDefaultsAndRoundTrips(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmp)
	t.Setenv("HOME", tmp)
	t.Setenv("AppData", tmp)
	t.Setenv("WS_PORT", "1500")
	t.Setenv("SERVER_PASSWORD", "secret")
	t.Setenv("PC_NAME", "Test Box")

	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Port != 1500 || cfg.Password != "secret" || cfg.Name != "Test Box" {
		t.Fatalf("env import failed: %+v", cfg)
	}
	if !cfg.StartServerOnLaunch {
		t.Fatal("expected StartServerOnLaunch default true")
	}

	path, _ := Path()
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("config not saved: %v", err)
	}
	if filepath.Dir(path) == tmp {
		t.Fatalf("config should live in a subdirectory, got %s", path)
	}

	cfg.Port = 1600
	if err := cfg.Save(); err != nil {
		t.Fatal(err)
	}
	// Environment must not override a saved file.
	t.Setenv("WS_PORT", "1700")
	again, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if again.Port != 1600 {
		t.Fatalf("expected saved port 1600, got %d", again.Port)
	}
}

func TestDefaultsWithoutEnv(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmp)
	t.Setenv("HOME", tmp)
	t.Setenv("AppData", tmp)
	for _, k := range []string{"WS_PORT", "SERVER_PASSWORD", "PC_NAME"} {
		t.Setenv(k, "")
		os.Unsetenv(k)
	}
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Port != DefaultPort || len(cfg.Password) != 6 || cfg.Name == "" {
		t.Fatalf("bad defaults: %+v", cfg)
	}
	if err := cfg.Validate(); err != nil {
		t.Fatal(err)
	}
}
