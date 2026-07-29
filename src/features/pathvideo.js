// Video obstacle-avoidance: extract frames → draw the green A* route on each →
// re-encode into a video. Uses the bundled ffmpeg (no external service).
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import { renderPathFromImage } from './pathfind.js';

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, args, { windowsHide: true });
    let err = '';
    p.stderr.on('data', (d) => { err += d.toString(); });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg exited ' + code + ': ' + err.slice(-300)))));
  });
}

// videoBuffer -> { mp4:Buffer, frames, found }. Bounded (short clip, small res).
export async function renderPathVideo(videoBuffer, { fps = 8, maxSeconds = 5, width = 480 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'pathvid-'));
  try {
    const inPath = join(dir, 'in');
    writeFileSync(inPath, videoBuffer);

    // 1) sample frames (cap length, fps and width so the work stays bounded)
    await ffmpeg(['-y', '-i', inPath, '-t', String(maxSeconds), '-vf', `fps=${fps},scale=${width}:-2`, join(dir, 'f%03d.png')]);
    const frames = readdirSync(dir).filter((f) => /^f\d+\.png$/.test(f)).sort();
    if (!frames.length) throw new Error('no frames extracted (unsupported/av-less video?)');

    // 2) draw the green route on every frame
    let anyFound = false;
    for (const f of frames) {
      const p = join(dir, f);
      const { png, found } = await renderPathFromImage(readFileSync(p), { cols: 64 });
      anyFound = anyFound || found;
      writeFileSync(p, png);
    }

    // 3) re-encode to mp4 (yuv420p + faststart so Discord/phones can play it)
    const outPath = join(dir, 'out.mp4');
    await ffmpeg(['-y', '-framerate', String(fps), '-i', join(dir, 'f%03d.png'), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outPath]);

    return { mp4: readFileSync(outPath), frames: frames.length, found: anyFound };
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp cleanup best-effort */ }
  }
}
