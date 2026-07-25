#!/usr/bin/env python3
"""
Sentinel — economy & activity analytics.

Reads the bot's SQLite database (read-only) and prints a real report: total money
supply, richest players, transaction volume, infractions, and top commands. Python
is a great fit for this kind of ad-hoc data crunching, and it never touches the
live bot — it just opens the same DB file the bot writes.

Usage:
    python tools/analytics.py                 # pretty report
    python tools/analytics.py --json          # machine-readable JSON
    python tools/analytics.py --db path.db    # custom DB path
    python tools/analytics.py --top 20        # show more rows
"""
import argparse
import json
import os
import sqlite3
import sys

DEFAULT_DB = os.path.join(os.path.dirname(__file__), "..", "data", "bot.db")


def q(cur, sql, params=()):
    try:
        cur.execute(sql, params)
        return cur.fetchall()
    except sqlite3.Error:
        return []


def one(cur, sql, params=(), default=0):
    rows = q(cur, sql, params)
    return rows[0][0] if rows and rows[0][0] is not None else default


def build_report(db_path, top):
    con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    cur = con.cursor()

    total_users = one(cur, "SELECT COUNT(*) FROM users")
    wallet = one(cur, "SELECT COALESCE(SUM(wallet),0) FROM balances")
    bank = one(cur, "SELECT COALESCE(SUM(bank),0) FROM balances")
    tx_count = one(cur, "SELECT COUNT(*) FROM transactions")
    infractions = one(cur, "SELECT COUNT(*) FROM infractions")

    richest = [
        {"user_id": uid, "wallet": w, "bank": b, "total": (w or 0) + (b or 0)}
        for (uid, w, b) in q(
            cur,
            "SELECT user_id, wallet, bank FROM balances "
            "ORDER BY (wallet + bank) DESC LIMIT ?",
            (top,),
        )
    ]

    top_commands = [
        {"command": name, "uses": n}
        for (name, n) in q(
            cur,
            "SELECT command, COUNT(*) n FROM command_usage GROUP BY command "
            "ORDER BY n DESC LIMIT ?",
            (top,),
        )
    ]

    con.close()
    return {
        "database": os.path.abspath(db_path),
        "users": total_users,
        "money_supply": {"wallet": wallet, "bank": bank, "total": wallet + bank},
        "transactions": tx_count,
        "infractions": infractions,
        "richest": richest,
        "top_commands": top_commands,
    }


def fmt(n):
    return f"{n:,}"


def print_report(r):
    line = "=" * 52
    print(line)
    print("  SENTINEL ANALYTICS")
    print(line)
    print(f"  Database      : {r['database']}")
    print(f"  Users         : {fmt(r['users'])}")
    ms = r["money_supply"]
    print(f"  Money supply  : {fmt(ms['total'])}  (wallet {fmt(ms['wallet'])}, bank {fmt(ms['bank'])})")
    print(f"  Transactions  : {fmt(r['transactions'])}")
    print(f"  Infractions   : {fmt(r['infractions'])}")
    print(line)
    print("  RICHEST PLAYERS")
    for i, p in enumerate(r["richest"], 1):
        print(f"   {i:>2}. {p['user_id']:<20} {fmt(p['total'])}")
    if r["top_commands"]:
        print(line)
        print("  TOP COMMANDS")
        for i, c in enumerate(r["top_commands"], 1):
            print(f"   {i:>2}. {c['command']:<20} {fmt(c['uses'])}")
    print(line)


def main():
    ap = argparse.ArgumentParser(description="Sentinel economy/activity analytics")
    ap.add_argument("--db", default=DEFAULT_DB, help="path to the SQLite DB")
    ap.add_argument("--json", action="store_true", help="output JSON")
    ap.add_argument("--top", type=int, default=10, help="rows per leaderboard")
    args = ap.parse_args()

    if not os.path.exists(args.db):
        print(f"error: database not found: {args.db}", file=sys.stderr)
        sys.exit(1)

    report = build_report(args.db, max(1, min(100, args.top)))
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print_report(report)


if __name__ == "__main__":
    main()
