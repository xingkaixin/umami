package config

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
)

type Config struct {
	URL      string `json:"url"`
	Token    string `json:"token"`
	Timezone string `json:"timezone,omitempty"`
}

func Path() (string, error) {
	if custom := strings.TrimSpace(os.Getenv("UMAMI_CONFIG")); custom != "" {
		return custom, nil
	}
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "umami", "config.json"), nil
}

func Load() (Config, string, error) {
	path, err := Path()
	if err != nil {
		return Config{}, "", err
	}
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return Config{}, path, nil
	}
	if err != nil {
		return Config{}, path, err
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return Config{}, path, err
	}
	return cfg, path, nil
}

func Save(cfg Config) (string, error) {
	path, err := Path()
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return "", err
	}
	cfg.URL = strings.TrimRight(strings.TrimSpace(cfg.URL), "/")
	cfg.Token = strings.TrimSpace(cfg.Token)
	cfg.Timezone = strings.TrimSpace(cfg.Timezone)

	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return "", err
	}
	data = append(data, '\n')
	if err := os.WriteFile(path, data, 0o600); err != nil {
		return "", err
	}
	return path, nil
}

func Remove() (string, error) {
	path, err := Path()
	if err != nil {
		return "", err
	}
	err = os.Remove(path)
	if errors.Is(err, os.ErrNotExist) {
		return path, nil
	}
	return path, err
}

func Resolve(flagURL, flagToken, flagTZ string) (Config, string, error) {
	cfg, path, err := Load()
	if err != nil {
		return Config{}, path, err
	}
	if v := strings.TrimSpace(os.Getenv("UMAMI_URL")); v != "" {
		cfg.URL = v
	}
	if v := strings.TrimSpace(os.Getenv("UMAMI_TOKEN")); v != "" {
		cfg.Token = v
	}
	if v := strings.TrimSpace(os.Getenv("UMAMI_TIMEZONE")); v != "" {
		cfg.Timezone = v
	}
	if v := strings.TrimSpace(flagURL); v != "" {
		cfg.URL = v
	}
	if v := strings.TrimSpace(flagToken); v != "" {
		cfg.Token = v
	}
	if v := strings.TrimSpace(flagTZ); v != "" {
		cfg.Timezone = v
	}
	cfg.URL = strings.TrimRight(strings.TrimSpace(cfg.URL), "/")
	cfg.Token = strings.TrimSpace(cfg.Token)
	cfg.Timezone = strings.TrimSpace(cfg.Timezone)
	return cfg, path, nil
}

func MaskToken(token string) string {
	token = strings.TrimSpace(token)
	if token == "" {
		return ""
	}
	if len(token) <= 12 {
		return token[:min(4, len(token))] + "..."
	}
	return token[:12] + "..."
}
