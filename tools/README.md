# Sentinel polyglot tools

Real, standalone utilities — each in a language picked for what it's genuinely
**good** at. None of these touch the live bot; they read files/DBs the bot writes,
or (for Luau) run inside Roblox. They are dev/ops tools, not fillers.

| Tool | Language | What it does | Runs where |
|------|----------|--------------|------------|
| `analytics.py` | **Python** | Economy & activity report from `data/bot.db` (money supply, richest players, tx volume, top commands). Python is ideal for quick data crunching. | Your PC (Python 3) |
| `transcript.cpp` | **C++** | Fast word-frequency + line/word/char stats over big exported chat logs / ticket transcripts. C++ excels at heavy string streaming. | Your PC (g++) |
| `logscan/` | **Rust** | Buckets PM2/bot log lines by severity (errors, warnings, restarts, logins) and shows recent errors + a health verdict. Fast, single static binary. | Your PC (cargo) |
| `../roblox/DiscordWebhook.luau` | **Luau** | Pushes in-game events (joins, reports) from a Roblox experience into a Discord channel as embeds. Luau is Roblox's native language. | Inside Roblox |

The live bot itself is **JavaScript** (Node.js). The **real** "ER:LC accelerator" is
not a separate language — it's a short-lived Redis cache on ER:LC GET requests
(`src/features/erlc.js`): you can't speed up someone else's API, but you can stop
asking it the same thing 10× a second.

## Build / run

**Python** (installed):
```bash
python tools/analytics.py            # pretty report
python tools/analytics.py --json     # JSON
```

**C++** (needs g++; static-link so it runs without MSYS2 DLLs on PATH):
```bash
g++ -O2 -std=c++17 -static -static-libstdc++ -static-libgcc tools/transcript.cpp -o tools/transcript.exe
./tools/transcript.exe --top 30 path/to/transcript.txt
```

**Rust** (needs the toolchain — install from https://rustup.rs):
```bash
cd tools/logscan && cargo build --release
./target/release/logscan ~/.pm2/logs/sentinel-error.log
```

**Luau** (runs in Roblox, nothing to install locally):
- Put `roblox/DiscordWebhook.luau` in your experience as a ModuleScript, enable
  HTTP requests, set `PROXY_URL` to a webhook proxy (Discord blocks direct Roblox
  requests), then `require()` it from a server Script.
