// Tiny in-memory ring buffer for live log streaming to the dashboard.
const MAX = 200;
const lines = [];
let seq = 0;

export function pushLog(level, message) {
  lines.push({ id: ++seq, t: Date.now(), level, message });
  if (lines.length > MAX) lines.shift();
}

// Return logs after a given id (for incremental polling).
export function getLogsAfter(afterId = 0) {
  return lines.filter((l) => l.id > afterId);
}

// Mirror console.log/warn/error into the bus so the dashboard sees bot activity.
export function hookConsole() {
  for (const level of ['log', 'warn', 'error']) {
    const orig = console[level].bind(console);
    console[level] = (...args) => {
      try {
        pushLog(level, args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
      } catch {
        /* ignore */
      }
      orig(...args);
    };
  }
}
