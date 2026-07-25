// Path tracer front-end: render a scene in a worker thread and hand back a PNG.
import { Worker } from 'node:worker_threads';
import { createCanvas } from '@napi-rs/canvas';
export { presetScene } from './tracer.js';

const workerURL = new URL('./worker.js', import.meta.url);

// Render a scene off-thread. Resolves to a PNG Buffer. Rejects on error/timeout.
export function renderScenePNG(scene, opts) {
  const { width, height } = opts;
  return new Promise((resolve, reject) => {
    let settled = false;
    // Don't inherit flags like --input-type that break a file-based worker.
    const execArgv = process.execArgv.filter((a) => !a.startsWith('--input-type'));
    const worker = new Worker(workerURL, { workerData: { scene, opts }, execArgv });
    const done = (fn) => (v) => { if (settled) return; settled = true; clearTimeout(timer); worker.terminate(); fn(v); };
    const ok = done(resolve);
    const fail = done(reject);
    const timer = setTimeout(() => fail(new Error('Render timed out (scene too heavy).')), 90_000);

    worker.on('message', (msg) => {
      if (!msg?.ok) return fail(new Error(msg?.error || 'render failed'));
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');
      const img = ctx.createImageData(width, height);
      img.data.set(msg.rgba);
      ctx.putImageData(img, 0, 0);
      ok(canvas.toBuffer('image/png'));
    });
    worker.on('error', (e) => fail(e));
    worker.on('exit', (code) => { if (code !== 0) fail(new Error('worker exited ' + code)); });
  });
}
