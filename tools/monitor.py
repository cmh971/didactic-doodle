#!/usr/bin/env python3
"""Sentinel health monitor.

Polls the bot's dashboard API and reports live status — servers, users, ping,
uptime — and warns after repeated failures. Handy for a cron job or a spare
terminal while the bot is hosted.

Usage:
    python tools/monitor.py                         # localhost, every 30s
    python tools/monitor.py --url https://mysite.com --interval 60
    python tools/monitor.py --interval 0            # check once and exit
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import timedelta


def fetch_stats(base_url: str) -> dict | None:
    """Fetch /api/stats. Returns the parsed JSON, or None if the bot is unreachable."""
    url = base_url.rstrip("/") + "/api/stats"
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            return json.load(resp)
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError):
        return None


def fmt_uptime(ms: int | None) -> str:
    return str(timedelta(seconds=int((ms or 0) / 1000)))


def check_once(base_url: str) -> bool:
    """Print a one-line status. Returns True if the bot looks healthy."""
    stats = fetch_stats(base_url)
    ts = time.strftime("%H:%M:%S")

    if stats is None:
        print(f"[{ts}] DOWN  no response from {base_url}")
        return False

    ping = stats.get("ping", 0)
    up = bool(stats.get("uptime"))
    flag = "OK  " if (up and ping < 300) else ("WARN" if up else "DOWN")
    print(
        f"[{ts}] {flag}  {stats.get('botName', 'bot')} - "
        f"{stats.get('guilds', 0)} servers, {stats.get('users', 0)} users, "
        f"{ping}ms, up {fmt_uptime(stats.get('uptime'))}"
    )
    return up


def main() -> None:
    parser = argparse.ArgumentParser(description="Monitor a Sentinel bot dashboard.")
    parser.add_argument("--url", default="http://localhost:3000", help="Dashboard base URL")
    parser.add_argument("--interval", type=int, default=30, help="Seconds between checks (0 = run once)")
    parser.add_argument("--alert-after", type=int, default=3, help="Warn after N consecutive failures")
    args = parser.parse_args()

    if args.interval <= 0:
        sys.exit(0 if check_once(args.url) else 1)

    print(f"Monitoring {args.url} every {args.interval}s  (Ctrl+C to stop)")
    failures = 0
    try:
        while True:
            healthy = check_once(args.url)
            failures = 0 if healthy else failures + 1
            if failures >= args.alert_after:
                print(f"!! {failures} consecutive failures - the bot may be down!")
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
