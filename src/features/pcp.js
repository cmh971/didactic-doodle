// Post's Correspondence Problem — a SOUND bounded solver.
//
// PCP is UNDECIDABLE (Post, 1946): no algorithm can always return a correct
// boolean for arbitrary input without risking an infinite loop. So a pure,
// guaranteed boolean is provably impossible. We do the honest thing instead:
//
//   • BFS over "overhang" configurations (the difference between the top and
//     bottom strings so far). One string must always be a prefix of the other,
//     or the branch is dead.
//   • A visited-set on overhang states makes the search a finite graph walk
//     *when the reachable state space is finite* — then we can PROVE 'NO'.
//   • Resource limits (max states, max overhang length) bound the run. Hitting
//     them yields 'UNDETERMINED' — the undecidability showing itself, not a bug.
//
// Result: 'YES' (+ witness sequence & matched word), a provable 'NO', or
// 'UNDETERMINED'. That three-valued answer is the correct CS.

// Compare two strings → 'equal' | null (dead) | { side:'top'|'bottom', s }.
function overhang(x, y) {
  if (x === y) return 'equal';
  if (x.startsWith(y)) return { side: 'top', s: x.slice(y.length) };
  if (y.startsWith(x)) return { side: 'bottom', s: y.slice(x.length) };
  return null;
}

// From a config where `side` is ahead by `s`, append tile (t,b).
function advance(side, s, t, b) {
  return side === 'top' ? overhang(s + t, b) : overhang(t, s + b);
}

export function solvePCP(tiles, { maxStates = 150000, maxOverhang = 120 } = {}) {
  const parents = new Map(); // configKey -> { parent, tile }
  const queue = [];
  let truncated = false;
  let explored = 0;
  // Encode side as one leading char ('t'/'b') so the key needs no separator.
  const key = (side, s) => (side === 'top' ? 't' : 'b') + s;
  const unkey = (k) => ({ side: k[0] === 't' ? 'top' : 'bottom', s: k.slice(1) });

  const seed = (cfg, tile) => {
    if (cfg.s.length > maxOverhang) { truncated = true; return; }
    const k = key(cfg.side, cfg.s);
    if (!parents.has(k)) { parents.set(k, { parent: null, tile }); queue.push(k); }
  };

  // Seed with each tile as the first domino.
  for (let i = 0; i < tiles.length; i++) {
    const [t, b] = tiles[i];
    const cfg = overhang(t, b);
    if (cfg === 'equal') return { result: 'YES', sequence: [i], word: t, explored: 1 };
    if (cfg) seed(cfg, i);
  }

  const reconstruct = (k) => {
    const out = [];
    let cur = k;
    while (cur !== null) { const e = parents.get(cur); out.push(e.tile); cur = e.parent; }
    return out.reverse();
  };

  let head = 0;
  while (head < queue.length) {
    if (explored >= maxStates) return { result: 'UNDETERMINED', explored, reason: 'state budget reached' };
    const k = queue[head++]; explored++;
    const { side, s } = unkey(k);

    for (let i = 0; i < tiles.length; i++) {
      const [t, b] = tiles[i];
      const step = advance(side, s, t, b);
      if (step === 'equal') {
        const seq = reconstruct(k).concat(i);
        return { result: 'YES', sequence: seq, word: seq.map((j) => tiles[j][0]).join(''), explored };
      }
      if (!step) continue;
      if (step.s.length > maxOverhang) { truncated = true; continue; }
      const nk = key(step.side, step.s);
      if (!parents.has(nk)) { parents.set(nk, { parent: k, tile: i }); queue.push(nk); }
    }
  }

  // Queue drained. If we never truncated, the reachable state space was finite
  // and fully explored → a genuine, provable NO. Otherwise, undecidable territory.
  if (truncated) return { result: 'UNDETERMINED', explored, reason: 'overhang exceeded max length — reachable state space may be infinite' };
  return { result: 'NO', explored };
}

// Parse "top/bottom" tiles separated by spaces or commas.
export function parseTiles(input) {
  const tokens = String(input || '').trim().split(/[\s,]+/).filter(Boolean);
  if (!tokens.length) throw new Error('give at least one tile like `a/ab`');
  if (tokens.length > 24) throw new Error('max 24 tiles');
  return tokens.map((tok) => {
    const slash = tok.indexOf('/');
    if (slash < 0) throw new Error(`tile "${tok}" needs a "/" (top/bottom)`);
    const top = tok.slice(0, slash);
    const bottom = tok.slice(slash + 1);
    if (!top && !bottom) throw new Error(`tile "${tok}" is empty`);
    if (top.length > 40 || bottom.length > 40) throw new Error('each side max 40 chars');
    return [top, bottom];
  });
}
