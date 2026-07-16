// Go — tiny health-check microservice. Polls the dashboard's /api/stats and
// exposes a rolled-up status on :3100/health. Build & run:
//   cd services/healthcheck && go run main.go
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

type stats struct {
	Guilds int `json:"guilds"`
	Users  int `json:"users"`
	Ping   int `json:"ping"`
}

func dashboardURL() string {
	if v := os.Getenv("DASHBOARD_URL"); v != "" {
		return v
	}
	return "http://localhost:3000"
}

func health(w http.ResponseWriter, _ *http.Request) {
	client := http.Client{Timeout: 4 * time.Second}
	resp, err := client.Get(dashboardURL() + "/api/stats")
	w.Header().Set("Content-Type", "application/json")
	if err != nil || resp.StatusCode != 200 {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]any{"ok": false, "error": "dashboard unreachable"})
		return
	}
	defer resp.Body.Close()
	var s stats
	json.NewDecoder(resp.Body).Decode(&s)
	json.NewEncoder(w).Encode(map[string]any{"ok": true, "guilds": s.Guilds, "users": s.Users, "ping": s.Ping})
}

func main() {
	http.HandleFunc("/health", health)
	fmt.Println("Go health-check on :3100/health → proxying", dashboardURL())
	if err := http.ListenAndServe(":3100", nil); err != nil {
		panic(err)
	}
}
