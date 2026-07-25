// Sentinel — bot health reader (Go).
//
// Reads the read-only snapshot the bot writes (data/insight.json) and prints a
// tidy health report. Go is a great fit for small, fast, single-binary CLIs, and
// its struct-tag JSON decoding makes this clean. It never touches the live bot.
//
// Run:   go run tools/insight/main.go            (from the repo root)
//        go build -o insight ./tools/insight     (standalone binary)
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
)

type Guild struct {
	Name     string        `json:"name"`
	Members  int           `json:"members"`
	Channels []interface{} `json:"channels"`
	Roles    []interface{} `json:"roles"`
}

type Insight struct {
	UpdatedAt string `json:"updatedAt"`
	Bot       struct {
		WsPing    int `json:"wsPing"`
		Guilds    int `json:"guilds"`
		Users     int `json:"users"`
		RssMB     int `json:"rssMB"`
		UptimeSec int `json:"uptimeSec"`
	} `json:"bot"`
	Guilds []Guild `json:"guilds"`
}

func main() {
	path := "data/insight.json"
	if len(os.Args) > 1 {
		path = os.Args[1]
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		fmt.Fprintln(os.Stderr, "error: cannot read", path, "-", err)
		os.Exit(1)
	}

	var in Insight
	if err := json.Unmarshal(raw, &in); err != nil {
		fmt.Fprintln(os.Stderr, "error: bad JSON -", err)
		os.Exit(1)
	}

	fmt.Println("==== BOT HEALTH (Go) ====")
	fmt.Printf("updated : %s\n", in.UpdatedAt)
	fmt.Printf("ws ping : %d ms\n", in.Bot.WsPing)
	fmt.Printf("guilds  : %d\n", in.Bot.Guilds)
	fmt.Printf("users   : %d\n", in.Bot.Users)
	fmt.Printf("memory  : %d MB\n", in.Bot.RssMB)
	fmt.Printf("uptime  : %d s\n", in.Bot.UptimeSec)

	// Biggest servers first.
	sort.Slice(in.Guilds, func(a, b int) bool { return in.Guilds[a].Members > in.Guilds[b].Members })
	fmt.Println("---- servers (by members) ----")
	for _, g := range in.Guilds {
		fmt.Printf("  %-32s %4d members  %3d channels  %3d roles\n", trunc(g.Name, 32), g.Members, len(g.Channels), len(g.Roles))
	}
}

func trunc(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n-1]) + "…"
}
