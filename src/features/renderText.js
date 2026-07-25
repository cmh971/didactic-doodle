// !render — the from-scratch path tracer as a prefix command.
//   !render                          → default showcase scene
//   !render glass 24 large           → preset + samples + size (any order)
//   !render {"camera":{…},"spheres":[…]}   → custom scene JSON
import { EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { renderScenePNG, presetScene } from './pathtracer/index.js';

const SIZES = { small: [320, 180], medium: [400, 225], large: [512, 288] };
const PRESETS = new Set(['showcase', 'glass', 'random']);

export async function handleRenderText(message) {
  const raw = (message.content || '').trim();
  if (!/^!render\b/i.test(raw)) return false;
  const after = raw.replace(/^!render\b/i, '').trim();

  let preset = 'showcase';
  let samples = 16;
  let size = 'medium';
  let scene = null;

  const jsonIdx = after.indexOf('{');
  const custom = jsonIdx !== -1;
  if (custom) {
    try { scene = JSON.parse(after.slice(jsonIdx)); }
    catch (e) { await message.reply('⚠️ Bad scene JSON: ' + e.message).catch(() => {}); return true; }
  }
  for (const t of (custom ? after.slice(0, jsonIdx) : after).split(/\s+/).filter(Boolean)) {
    const tl = t.toLowerCase();
    if (PRESETS.has(tl)) preset = tl;
    else if (SIZES[tl]) size = tl;
    else if (/^\d+$/.test(t)) samples = Math.max(4, Math.min(48, parseInt(t, 10)));
  }

  if (!scene) scene = presetScene(preset);
  if (!Array.isArray(scene.spheres) || scene.spheres.length < 1 || scene.spheres.length > 40) {
    await message.reply('⚠️ Scene needs 1–40 spheres.').catch(() => {}); return true;
  }
  if (!scene.camera) scene.camera = {};
  const [width, height] = SIZES[size];

  const status = await message.reply('🎨 Path-tracing… (rendering off-thread)').catch(() => null);
  const t = Date.now();
  let png;
  try { png = await renderScenePNG(scene, { width, height, samples, depth: 12 }); }
  catch (e) { await status?.edit('⚠️ Render failed: ' + e.message).catch(() => {}); return true; }

  const embed = new EmbedBuilder()
    .setColor(0x8b93ff)
    .setTitle('🌌 Path-traced render')
    .setDescription('Physically-based Monte Carlo path tracer, **built from scratch** — no Blender, no API.')
    .addFields(
      { name: 'Scene', value: custom ? 'custom JSON' : preset, inline: true },
      { name: 'Resolution', value: `${width}×${height}`, inline: true },
      { name: 'Samples/px', value: `${samples}`, inline: true },
      { name: 'Spheres', value: `${scene.spheres.length}`, inline: true },
      { name: 'Render time', value: `${Date.now() - t} ms`, inline: true },
      { name: 'Features', value: 'GI · reflections · refractions · shadows', inline: true },
    )
    .setImage('attachment://render.png')
    .setFooter({ text: '!render [preset] [samples] [size] · rendered off-thread' });

  await status?.edit({ content: '', embeds: [embed], files: [new AttachmentBuilder(png, { name: 'render.png' })] }).catch(() => {});
  return true;
}
