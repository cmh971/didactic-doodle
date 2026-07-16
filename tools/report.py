#!/usr/bin/env python3
"""Python — analytics report. Reads the bot's SQLite DB and prints a summary.
Usage:  python tools/report.py
"""
import os
import sqlite3
import sys

DB = os.path.join(os.path.dirname(__file__), "..", "data", "bot.db")


def main() -> int:
    if not os.path.exists(DB):
        print("No database yet — run the bot first.")
        return 1

    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    print("=== UNO Bot Report ===\n")

    cur.execute("SELECT COUNT(*) AS n FROM users")
    print(f"Users: {cur.fetchone()['n']}")

    cur.execute("SELECT COUNT(*) AS n FROM community_config")
    total = cur.fetchone()["n"]
    cur.execute("SELECT COUNT(*) AS n FROM community_config WHERE is_approved = 0")
    pending = cur.fetchone()["n"]
    print(f"Communities: {total} ({pending} pending approval)\n")

    print("Top 10 richest:")
    cur.execute(
        "SELECT user_id, wallet + bank AS total FROM balances "
        "WHERE scope = 'global' ORDER BY total DESC LIMIT 10"
    )
    for i, row in enumerate(cur.fetchall(), 1):
        print(f"  {i:>2}. {row['user_id']:<20} {row['total']:>15,} tokens")

    con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
