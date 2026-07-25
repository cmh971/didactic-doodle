// Worker-thread entry for the path tracer. Runs the (heavy) render off the main
// thread so the bot never freezes for other users while an image renders.
import { parentPort, workerData } from 'node:worker_threads';
import { renderRGBA } from './tracer.js';

try {
  const { scene, opts } = workerData;
  const rgba = renderRGBA(scene, opts);
  // Transfer the pixel buffer back (zero-copy).
  parentPort.postMessage({ ok: true, rgba }, [rgba.buffer]);
} catch (err) {
  parentPort.postMessage({ ok: false, error: String(err?.message || err) });
}
