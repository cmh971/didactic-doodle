# Tech Stack — Languages in this Project

The **live bot + website run on Node.js** (JavaScript). The other languages are
**real, runnable/compilable tools and schemas** — each does a genuine job. The
compiled-language pieces (Go / C++ / C#) are standalone: they build with their
own toolchains and are not imported by the Node process (so they can never break
the bot).

| Language | File | What it does | Runs with |
|----------|------|--------------|-----------|
| **HTML** | `src/web/public/index.html`, community pages | Dashboard + community UI | browser |
| **CSS3** | `src/web/public/style.css` | Themed, responsive, RTL-aware styling | browser |
| **JavaScript** | `index.js`, `src/**` | The bot + Express dashboard (live system) | `npm start` |
| **TypeScript** | `web/public/ts/community.ts` | Typed SSE client + API types | `tsc` |
| **SQL** | `src/db/schema.sql`, `tools/analytics.sql` | Postgres schema + analytics queries | `psql` / `sqlite3` |
| **NoSQL (MQL)** | `src/models/CommunityConfig.js`, `src/db/mongo.queries.js` | Mongoose schema + MongoDB queries/aggregation | MongoDB |
| **Python** | `tools/report.py` | Reads the SQLite DB, prints a stats report | `python` |
| **GraphQL** | `web/schema.graphql` | SDL for the community/economy API | any GraphQL server |
| **Bash** | `scripts/backup.sh` | Safe SQLite backup + rotation | `bash` |
| **Markdown** | `README.md`, this file, `homePageMarkdown` | Docs + community page content | rendered |
| **Go** | `services/healthcheck/main.go` | Health-check microservice (`:3100/health`) | `go run` |
| **C++** | `tools/discount.cpp` | Fast Robux discount/tax CLI | `g++` |
| **C#** | `tools/StatsExporter.cs` | Exports an economy summary to JSON | `dotnet` / `csc` |

## Quick runs

```bash
python tools/report.py                 # Python report
sqlite3 data/bot.db ".read tools/analytics.sql"   # SQL analytics
bash scripts/backup.sh                 # Bash backup
cd services/healthcheck && go run main.go          # Go microservice
g++ -O2 -o discount tools/discount.cpp && ./discount 1000 25   # C++
dotnet run --project tools             # C# (or: csc tools/StatsExporter.cs)
```

> Note: these are genuine artifacts, not stubs. The Node app is the source of
> truth; the standalone tools read its data or call its API.
