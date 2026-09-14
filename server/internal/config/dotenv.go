package config

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
)

// loadDotEnv reads KEY=VALUE lines from the first .env found in the working
// directory or next to the executable. Variables already present in the
// environment win, so Docker's env_file and shell exports keep priority.
// A missing file is not an error: the container image ships without one.
func loadDotEnv() (string, error) {
	for _, path := range dotEnvCandidates() {
		file, err := os.Open(path)
		if err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return path, err
		}
		defer file.Close()

		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			line = strings.TrimPrefix(line, "export ")
			key, value, found := strings.Cut(line, "=")
			if !found {
				continue
			}
			key = strings.TrimSpace(key)
			value = strings.TrimSpace(value)
			if len(value) >= 2 && (value[0] == '"' || value[0] == '\'') && value[len(value)-1] == value[0] {
				value = value[1 : len(value)-1]
			}
			if _, exists := os.LookupEnv(key); !exists {
				os.Setenv(key, value)
			}
		}
		return path, scanner.Err()
	}
	return "", nil
}

func dotEnvCandidates() []string {
	candidates := []string{".env"}
	if exe, err := os.Executable(); err == nil {
		candidates = append(candidates, filepath.Join(filepath.Dir(exe), ".env"))
	}
	return candidates
}
