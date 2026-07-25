//! Sentinel — log analyzer (Rust, std-only, no external crates).
//!
//! Streams a PM2 / bot log file and buckets every line by severity so you can
//! see at a glance how healthy the bot has been: how many errors, warnings,
//! crashes/restarts, and successful logins — plus the most recent errors.
//!
//! Rust is a great fit: it's fast over big log files and the single static
//! binary has no runtime to install. It's a dev/ops tool — it never touches the
//! live bot, just reads a log file (or stdin).
//!
//! Build:  cd tools/logscan && cargo build --release
//! Run:    ./target/release/logscan  ~/.pm2/logs/sentinel-error.log
//!         pm2 logs sentinel --nostream --lines 500 | ./target/release/logscan

use std::env;
use std::fs::File;
use std::io::{self, BufRead, BufReader};

#[derive(Default)]
struct Stats {
    total: u64,
    errors: u64,
    warnings: u64,
    logins: u64,
    restarts: u64,
    recent_errors: Vec<String>,
}

fn classify(line: &str, s: &mut Stats) {
    let l = line.to_lowercase();
    s.total += 1;

    if l.contains("error") || l.contains("exception") || l.contains("unhandled") || l.contains("rejection") {
        s.errors += 1;
        s.recent_errors.push(line.trim().to_string());
        if s.recent_errors.len() > 10 {
            s.recent_errors.remove(0);
        }
    } else if l.contains("warn") {
        s.warnings += 1;
    }

    if l.contains("logged in as") {
        s.logins += 1;
    }
    if (l.contains("registered") && l.contains("command")) || l.contains("launched") {
        s.restarts += 1;
    }
}

fn main() {
    let path = env::args().nth(1);

    let reader: Box<dyn BufRead> = match &path {
        Some(p) => match File::open(p) {
            Ok(f) => Box::new(BufReader::new(f)),
            Err(e) => {
                eprintln!("error: cannot open {p}: {e}");
                std::process::exit(1);
            }
        },
        None => Box::new(BufReader::new(io::stdin().lock())),
    };

    let mut s = Stats::default();
    for line in reader.lines() {
        match line {
            Ok(l) => classify(&l, &mut s),
            Err(_) => break, // non-UTF8 chunk — stop cleanly
        }
    }

    let health = if s.errors == 0 {
        "healthy"
    } else if s.errors < 5 {
        "minor issues"
    } else {
        "needs attention"
    };

    println!("==== LOG ANALYSIS ====");
    println!("source   : {}", path.as_deref().unwrap_or("<stdin>"));
    println!("lines    : {}", s.total);
    println!("errors   : {}", s.errors);
    println!("warnings : {}", s.warnings);
    println!("logins   : {}", s.logins);
    println!("restarts : {}", s.restarts);
    println!("health   : {health}");

    if !s.recent_errors.is_empty() {
        println!("---- recent errors ----");
        for e in &s.recent_errors {
            let shown: String = e.chars().take(160).collect();
            println!("  • {shown}");
        }
    }
}
