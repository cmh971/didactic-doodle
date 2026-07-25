// Regex visualizer — a REAL implementation, not a wrapper around JS RegExp.
// Pipeline: parse the pattern into an AST → build a Thompson NFA (ε-transitions
// and all) → simulate it as a set-of-active-states machine, one input char at a
// time → render each step to a canvas frame → encode the frames into an animated
// GIF. This is the textbook Thompson NFA construction + subset simulation.
//
// Supported syntax: literals, concatenation, alternation |, grouping (), the
// quantifiers * + ?, the wildcard ., and character classes [...] (with ranges
// and negation [^...]). Enough to build genuinely gnarly expressions.
import { createCanvas } from '@napi-rs/canvas';
import gifenc from 'gifenc';

const { GIFEncoder, quantize, applyPalette } = gifenc;

// ---------------------------------------------------------------- parser (AST)
function parse(src) {
  let i = 0;
  const peek = () => src[i];
  const eat = () => src[i++];

  function parseAlt() {
    const opts = [parseConcat()];
    while (peek() === '|') { eat(); opts.push(parseConcat()); }
    return opts.length === 1 ? opts[0] : { type: 'alt', options: opts };
  }
  function parseConcat() {
    const parts = [];
    while (i < src.length && peek() !== '|' && peek() !== ')') parts.push(parseRepeat());
    if (parts.length === 0) return { type: 'empty' };
    return parts.length === 1 ? parts[0] : { type: 'concat', parts };
  }
  function parseRepeat() {
    let node = parseAtom();
    while (peek() === '*' || peek() === '+' || peek() === '?') {
      const op = eat();
      node = { type: op === '*' ? 'star' : op === '+' ? 'plus' : 'opt', child: node };
    }
    return node;
  }
  function parseAtom() {
    const c = peek();
    if (c === '(') { eat(); const inner = parseAlt(); if (peek() === ')') eat(); return inner; }
    if (c === '[') return parseClass();
    if (c === '.') { eat(); return { type: 'any' }; }
    if (c === '\\') { eat(); const e = eat(); return { type: 'char', value: escapeChar(e) }; }
    eat();
    return { type: 'char', value: c };
  }
  function parseClass() {
    eat(); // [
    let negate = false;
    if (peek() === '^') { eat(); negate = true; }
    const ranges = [];
    while (i < src.length && peek() !== ']') {
      let lo = eat();
      if (lo === '\\') lo = escapeChar(eat());
      if (peek() === '-' && src[i + 1] !== ']') { eat(); let hi = eat(); if (hi === '\\') hi = escapeChar(eat()); ranges.push([lo, hi]); }
      else ranges.push([lo, lo]);
    }
    if (peek() === ']') eat();
    return { type: 'class', negate, ranges };
  }
  function escapeChar(e) {
    return ({ n: '\n', t: '\t', r: '\r' })[e] ?? e;
  }

  const ast = parseAlt();
  if (i < src.length) throw new Error('Unexpected character at position ' + i);
  return ast;
}

function astToString(n) {
  switch (n.type) {
    case 'char': return JSON.stringify(n.value);
    case 'any': return '.';
    case 'empty': return 'ε';
    case 'class': return `[${n.negate ? '^' : ''}${n.ranges.map(([a, b]) => (a === b ? a : `${a}-${b}`)).join('')}]`;
    case 'star': return `star(${astToString(n.child)})`;
    case 'plus': return `plus(${astToString(n.child)})`;
    case 'opt': return `opt(${astToString(n.child)})`;
    case 'alt': return `alt(${n.options.map(astToString).join(', ')})`;
    case 'concat': return `concat(${n.parts.map(astToString).join(', ')})`;
    default: return '?';
  }
}

// ------------------------------------------------- Thompson NFA construction
function buildNFA(ast) {
  const states = [];
  const newState = () => { const s = { id: states.length, eps: [], trans: [] }; states.push(s); return s; };

  function frag(node) {
    switch (node.type) {
      case 'empty': { const s = newState(); return { start: s.id, accept: s.id }; }
      case 'char': { const s = newState(); const a = newState(); s.trans.push({ on: { kind: 'char', c: node.value }, to: a.id }); return { start: s.id, accept: a.id }; }
      case 'any': { const s = newState(); const a = newState(); s.trans.push({ on: { kind: 'any' }, to: a.id }); return { start: s.id, accept: a.id }; }
      case 'class': { const s = newState(); const a = newState(); s.trans.push({ on: { kind: 'class', node }, to: a.id }); return { start: s.id, accept: a.id }; }
      case 'concat': {
        let f = frag(node.parts[0]);
        for (let k = 1; k < node.parts.length; k++) { const g = frag(node.parts[k]); states[f.accept].eps.push(g.start); f = { start: f.start, accept: g.accept }; }
        return f;
      }
      case 'alt': {
        const s = newState(); const a = newState();
        for (const opt of node.options) { const g = frag(opt); s.eps.push(g.start); states[g.accept].eps.push(a.id); }
        return { start: s.id, accept: a.id };
      }
      case 'star': { const s = newState(); const a = newState(); const g = frag(node.child); s.eps.push(g.start, a.id); states[g.accept].eps.push(g.start, a.id); return { start: s.id, accept: a.id }; }
      case 'plus': { const a = newState(); const g = frag(node.child); states[g.accept].eps.push(g.start, a.id); return { start: g.start, accept: a.id }; }
      case 'opt': { const s = newState(); const a = newState(); const g = frag(node.child); s.eps.push(g.start, a.id); states[g.accept].eps.push(a.id); return { start: s.id, accept: a.id }; }
      default: { const s = newState(); return { start: s.id, accept: s.id }; }
    }
  }
  const f = frag(ast);
  return { states, start: f.start, accept: f.accept };
}

function matches(on, ch) {
  if (on.kind === 'any') return ch !== '\n';
  if (on.kind === 'char') return on.c === ch;
  if (on.kind === 'class') {
    const inRange = on.node.ranges.some(([a, b]) => ch >= a && ch <= b);
    return on.node.negate ? !inRange : inRange;
  }
  return false;
}

// ------------------------------------------------------ simulation (subset)
function simulate(nfa, input) {
  const { states, start, accept } = nfa;
  const closure = (ids) => {
    const set = new Set(ids); const stack = [...ids];
    while (stack.length) { const id = stack.pop(); for (const e of states[id].eps) if (!set.has(e)) { set.add(e); stack.push(e); } }
    return set;
  };
  let cur = closure([start]);
  const steps = [{ pos: 0, char: null, active: cur }];
  for (let p = 0; p < input.length; p++) {
    const ch = input[p];
    const next = new Set();
    for (const id of cur) for (const t of states[id].trans) if (matches(t.on, ch)) next.add(t.to);
    cur = closure(next);
    steps.push({ pos: p + 1, char: ch, active: cur });
    if (cur.size === 0) break; // stuck — no further progress possible
  }
  const matched = cur.has(accept) && steps[steps.length - 1].pos === input.length;
  return { steps, matched, accept, start };
}

// ------------------------------------------------------------- layout + render
function layout(nfa, W, H) {
  const { states, start } = nfa;
  // Layer = BFS distance from the start (first-visit), so the graph flows L→R.
  const depth = new Array(states.length).fill(-1);
  depth[start] = 0; const q = [start];
  while (q.length) {
    const id = q.shift();
    const nexts = [...states[id].eps, ...states[id].trans.map((t) => t.to)];
    for (const n of nexts) if (depth[n] === -1) { depth[n] = depth[id] + 1; q.push(n); }
  }
  const maxD = Math.max(1, ...depth.map((d) => (d < 0 ? 0 : d)));
  const byLayer = {};
  states.forEach((s) => { const d = depth[s.id] < 0 ? maxD : depth[s.id]; (byLayer[d] ??= []).push(s.id); });
  const padX = 60; const padY = 90; const colW = (W - padX * 2) / maxD;
  const pos = {};
  for (const [d, ids] of Object.entries(byLayer)) {
    const rows = ids.length; const rowH = (H - padY - 30) / (rows + 1);
    ids.forEach((id, r) => { pos[id] = { x: padX + Number(d) * colW, y: padY + rowH * (r + 1) }; });
  }
  return pos;
}

function renderFrame(nfa, step, input, pos, W, H, done, matched) {
  const canvas = createCanvas(W, H); const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0b0d13'; ctx.fillRect(0, 0, W, H);

  // input string with cursor
  ctx.font = 'bold 20px monospace'; ctx.textBaseline = 'middle';
  const chars = [...input]; let x = 24;
  for (let k = 0; k < chars.length; k++) {
    const consumed = k < step.pos; const atCursor = k === step.pos;
    ctx.fillStyle = atCursor ? '#facc15' : consumed ? '#22c55e' : '#5b6472';
    if (atCursor) { ctx.fillStyle = '#3a2f00'; ctx.fillRect(x - 2, 14, 18, 26); ctx.fillStyle = '#facc15'; }
    ctx.fillText(chars[k], x, 28); x += 15;
  }
  ctx.fillStyle = '#98a0b3'; ctx.font = '13px monospace';
  ctx.fillText(step.char == null ? 'start (ε-closure)' : `consumed '${step.char}'  ·  step ${step.pos}/${input.length}`, 24, 56);

  // edges
  const drawArrow = (a, b, label, dashed) => {
    if (!pos[a] || !pos[b]) return;
    const p = pos[a]; const qy = pos[b];
    ctx.strokeStyle = dashed ? '#39415a' : '#5b6cff'; ctx.lineWidth = 1.5;
    ctx.setLineDash(dashed ? [4, 4] : []);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(qy.x, qy.y); ctx.stroke(); ctx.setLineDash([]);
    if (label) { ctx.fillStyle = '#c9d1e6'; ctx.font = '12px monospace'; ctx.fillText(label, (p.x + qy.x) / 2 + 3, (p.y + qy.y) / 2 - 4); }
  };
  for (const s of nfa.states) {
    for (const e of s.eps) drawArrow(s.id, e, 'ε', true);
    for (const t of s.trans) drawArrow(s.id, t.to, t.on.kind === 'any' ? '.' : t.on.kind === 'class' ? '[…]' : t.on.c, false);
  }
  // nodes
  for (const s of nfa.states) {
    const p = pos[s.id]; if (!p) continue;
    const active = step.active.has(s.id);
    ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
    ctx.fillStyle = active ? '#22c55e' : '#1c2130'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = s.id === nfa.accept ? '#facc15' : active ? '#86efac' : '#39415a'; ctx.stroke();
    if (s.id === nfa.accept) { ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.stroke(); }
    if (s.id === nfa.start) { ctx.fillStyle = '#8b93ff'; ctx.font = '11px monospace'; ctx.fillText('▶', p.x - 26, p.y); }
    ctx.fillStyle = active ? '#04220f' : '#8a93a6'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
    ctx.fillText(String(s.id), p.x, p.y); ctx.textAlign = 'left';
  }
  // verdict on the final frame
  if (done) {
    ctx.fillStyle = matched ? '#22c55e' : '#ef4444'; ctx.font = 'bold 22px sans-serif';
    ctx.fillText(matched ? '✅ MATCH' : '❌ NO MATCH', 24, H - 24);
  }
  return ctx.getImageData(0, 0, W, H);
}

// Public API: returns { ast, astStr, nfa, sim, gif (Buffer) } or throws.
export function visualizeRegex(pattern, input) {
  const ast = parse(pattern);
  const nfa = buildNFA(ast);
  if (nfa.states.length > 60) throw new Error(`NFA too large to animate cleanly (${nfa.states.length} states). Try a simpler pattern.`);
  if (input.length > 28) throw new Error('Test string too long to animate (max 28 chars).');
  const sim = simulate(nfa, input);

  const W = 820; const H = 460;
  const pos = layout(nfa, W, H);
  const enc = GIFEncoder();
  sim.steps.forEach((step, k) => {
    const done = k === sim.steps.length - 1;
    const img = renderFrame(nfa, step, input, pos, W, H, done, sim.matched);
    const pal = quantize(img.data, 128);
    const idx = applyPalette(img.data, pal);
    enc.writeFrame(idx, W, H, { palette: pal, delay: done ? 1600 : 850 });
  });
  enc.finish();
  return { ast, astStr: astToString(ast), nfa, sim, gif: Buffer.from(enc.bytes()) };
}
