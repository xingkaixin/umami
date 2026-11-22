package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

func TestCLISummaryAndAuthFlow(t *testing.T) {
	t.Setenv("UMAMI_CONFIG", filepath.Join(t.TempDir(), "config.json"))

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer umk_testtoken123456" {
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]any{"message": "Unauthorized"}})
			return
		}
		switch r.URL.Path {
		case "/api/auth/verify":
			_ = json.NewEncoder(w).Encode(map[string]any{"id": "u1", "username": "kevin", "role": "admin", "isAdmin": true})
		case "/api/websites":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"data": []map[string]any{
					{"id": "site-1", "name": "Personal Blog", "domain": "blog.example.com"},
				},
				"count":    1,
				"page":     1,
				"pageSize": 100,
			})
		case "/api/websites/site-1/stats":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"pageviews": 1200,
				"visitors":  400,
				"visits":    500,
				"bounces":   150,
				"totaltime": 45000,
				"comparison": map[string]any{
					"pageviews": 1000,
					"visitors":  350,
					"visits":    420,
					"bounces":   160,
					"totaltime": 38000,
				},
			})
		case "/api/websites/site-1/active":
			_ = json.NewEncoder(w).Encode(map[string]any{"visitors": 7})
		case "/api/websites/site-1/metrics":
			metricType := r.URL.Query().Get("type")
			_ = json.NewEncoder(w).Encode([]map[string]any{{"x": metricType + "-top", "y": 42}})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	var stdout, stderr bytes.Buffer
	code := Run(context.Background(), []string{
		"auth", "login", "--url", server.URL, "--token", "umk_testtoken123456",
	}, nil, &stdout, &stderr, "test")
	if code != 0 {
		t.Fatalf("auth login failed (%d): %s", code, stderr.String())
	}
	if !strings.Contains(stdout.String(), "Authenticated as kevin") {
		t.Fatalf("unexpected login output: %s", stdout.String())
	}

	stdout.Reset()
	stderr.Reset()
	code = Run(context.Background(), []string{"summary", "blog.example.com", "--range", "7d", "--json"}, nil, &stdout, &stderr, "test")
	if code != 0 {
		t.Fatalf("summary failed (%d): %s", code, stderr.String())
	}
	var report summaryReport
	if err := json.Unmarshal(stdout.Bytes(), &report); err != nil {
		t.Fatalf("invalid summary JSON: %v\n%s", err, stdout.String())
	}
	if report.Website.ID != "site-1" || report.Active != 7 || report.Stats.Pageviews != 1200 {
		t.Fatalf("unexpected summary payload: %+v", report)
	}
	if len(report.TopPages) != 1 || report.TopPages[0].X != "path-top" {
		t.Fatalf("unexpected top pages: %+v", report.TopPages)
	}
}
