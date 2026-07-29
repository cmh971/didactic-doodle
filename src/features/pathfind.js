// Obstacle-avoidance pathfinding on a photo — real A* search, no external API.
//
// Pipeline: load the image → downsample to an occupancy grid (dark regions =
// obstacles) → run A* (8-connected, octile heuristic) from the bottom-center to
// the top-center → draw the green route back onto the full-res photo, with a
// faint red overlay of what it detected as obstacles.
//
// This is genuine 2D navigation. (True 3D-from-photos is photogrammetry — a
// different, research-grade problem we don't pretend to solve.)
import { createCanvas, loadImage } from '@napi-rs/canvas';

// A* on a boolean occupancy grid. Returns an array of [c,r] cells or null.
//
// Uses a real binary-heap priority queue (keyed on f = g + h) plus a `closed`
// set so every cell is finalized at most once — that keeps it O(E log V) and,
// critically, means it can't spin forever re-scanning a bloated open list (the
// old linear-scan version had no closed set and could grind for minutes on a
// blocked photo). A hard expansion cap is a final guaranteed escape hatch.
export function astar(obstacle, cols, rows, start, goal) {
  const N = cols * rows;
  const idx = (c, r) => r * cols + c;
  const inb = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows;
  const h = (c, r) => { const dx = Math.abs(c - goal[0]); const dy = Math.abs(r - goal[1]); return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy); };
  const g = new Float64Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const nbr = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  // Binary min-heap of cell indices, ordered by f[]. O(log n) push/pop.
  const heap = []; const f = new Float64Array(N).fill(Infinity);
  const swap = (i, j) => { const t = heap[i]; heap[i] = heap[j]; heap[j] = t; };
  const push = (k) => {
    heap.push(k); let i = heap.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (f[heap[p]] <= f[heap[i]]) break; swap(i, p); i = p; }
  };
  const pop = () => {
    const top = heap[0]; const last = heap.pop();
    if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1; const r = 2 * i + 2; let m = i; if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l; if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r; if (m === i) break; swap(i, m); i = m; } }
    return top;
  };

  const s = idx(start[0], start[1]);
  g[s] = 0; f[s] = h(start[0], start[1]); push(s);
  const goalK = idx(goal[0], goal[1]);
  let expansions = 0; const CAP = N + 8; // every cell finalized at most once

  while (heap.length) {
    if (++expansions > CAP) return null; // safety net — cannot hang
    const cur = pop();
    if (closed[cur]) continue; // stale duplicate heap entry
    closed[cur] = 1;
    if (cur === goalK) {
      const path = []; let k = cur;
      while (k !== -1) { path.push([k % cols, Math.floor(k / cols)]); k = came[k]; }
      return path.reverse();
    }
    const cc = cur % cols; const cr = Math.floor(cur / cols);
    for (const [dc, dr] of nbr) {
      const nc = cc + dc; const nr = cr + dr;
      if (!inb(nc, nr)) continue;
      const nk = idx(nc, nr);
      if (obstacle[nk] || closed[nk]) continue;
      if (dc && dr && (obstacle[idx(cc + dc, cr)] || obstacle[idx(cc, cr + dr)])) continue; // no corner-cutting
      const ng = g[cur] + (dc && dr ? Math.SQRT2 : 1);
      if (ng < g[nk]) {
        g[nk] = ng; came[nk] = cur; f[nk] = ng + h(nc, nr); push(nk);
      }
    }
  }
  return null;
}

// Find the nearest free cell to (c,r) via a small spiral — start/goal may land on an obstacle.
export function nearestFree(obstacle, cols, rows, c, r) {
  for (let rad = 0; rad < Math.max(cols, rows); rad++) {
    for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
      const nc = c + dc; const nr = r + dr;
      if (nc >= 0 && nr >= 0 && nc < cols && nr < rows && !obstacle[nr * cols + nc]) return [nc, nr];
    }
  }
  return null;
}

export async function renderPathFromImage(buffer, { cols = 80, colorTol = 0.20, darkTol = 0.22 } = {}) {
  const img = await loadImage(buffer);
  const W = img.width; const H = img.height;
  const rows = Math.max(20, Math.round(cols * (H / W)));

  // Downsample into the occupancy grid.
  const gc = createCanvas(cols, rows); const gctx = gc.getContext('2d');
  gctx.drawImage(img, 0, 0, cols, rows);
  const px = gctx.getImageData(0, 0, cols, rows).data;

  // Obstacle detection by "NOT floor" (not just "dark"). We sample the ground
  // color from the band right in front of the camera (bottom-center — where you
  // are standing), then any cell whose color differs enough from that floor is
  // an obstacle to route AROUND. This makes light-colored obstacles (a couch, a
  // wall, a person) block the path instead of being walked straight through.
  const cx = Math.floor(cols / 2);
  const bandR = Math.max(2, Math.floor(rows * 0.12));
  const bandC = Math.max(2, Math.floor(cols * 0.18));
  let fr = 0; let fg = 0; let fb = 0; let n = 0;
  for (let r = rows - 1; r >= rows - bandR; r--) {
    for (let c = cx - bandC; c <= cx + bandC; c++) {
      if (c < 0 || c >= cols || r < 0) continue;
      const i = (r * cols + c) * 4; fr += px[i]; fg += px[i + 1]; fb += px[i + 2]; n++;
    }
  }
  fr /= n; fg /= n; fb /= n; // average floor color

  const obstacle = new Uint8Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) {
    const R = px[i * 4]; const G = px[i * 4 + 1]; const B = px[i * 4 + 2];
    const lum = (0.299 * R + 0.587 * G + 0.114 * B) / 255;
    const dist = Math.sqrt((R - fr) ** 2 + (G - fg) ** 2 + (B - fb) ** 2) / 441.673; // 0..1 color diff from floor
    // Obstacle if it doesn't look like the floor, OR it's very dark (shadow/hole).
    obstacle[i] = (dist > colorTol || lum < darkTol) ? 1 : 0;
  }

  const start = nearestFree(obstacle, cols, rows, Math.floor(cols / 2), rows - 1);
  const goal = nearestFree(obstacle, cols, rows, Math.floor(cols / 2), 0);
  const path = (start && goal) ? astar(obstacle, cols, rows, start, goal) : null;

  // Composite onto the photo — but CAP the output resolution. A full-res phone
  // photo (e.g. 4032×3024) would encode to a 20–40MB PNG and blow past Discord's
  // 8MB upload limit, making the follow-up message edit throw (and hang the
  // "Detecting…" message). Scaling to ~1280px keeps the PNG a few hundred KB.
  const scale = Math.min(1, 1280 / Math.max(W, H));
  const OW = Math.max(1, Math.round(W * scale));
  const OH = Math.max(1, Math.round(H * scale));
  const out = createCanvas(OW, OH); const ctx = out.getContext('2d');
  ctx.drawImage(img, 0, 0, OW, OH);
  const cw = OW / cols; const ch = OH / rows;
  // faint red obstacle overlay
  ctx.fillStyle = 'rgba(255,40,40,0.28)';
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (obstacle[r * cols + c]) ctx.fillRect(c * cw, r * ch, cw + 1, ch + 1);

  if (path) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = Math.max(6, cw * 0.7);
    ctx.beginPath(); path.forEach(([c, r], i) => { const x = (c + 0.5) * cw; const y = (r + 0.5) * ch; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    ctx.strokeStyle = '#22ff55'; ctx.lineWidth = Math.max(3, cw * 0.4);
    ctx.beginPath(); path.forEach(([c, r], i) => { const x = (c + 0.5) * cw; const y = (r + 0.5) * ch; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    const dot = (cell, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc((cell[0] + 0.5) * cw, (cell[1] + 0.5) * ch, Math.max(6, cw * 0.6), 0, Math.PI * 2); ctx.fill(); };
    dot(start, '#00e5ff'); dot(goal, '#ffd23f');
  }

  return { png: out.toBuffer('image/png'), found: !!path, cells: path ? path.length : 0, cols, rows };
}
