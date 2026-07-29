// !3d / !model — drop a 3D scan or model file and get an interactive viewer link.
// The viewer AUTO-PICKS the renderer by file type:
//   .splat        → gsplat (gaussian splatting)
//   .glb / .gltf  → @google/model-viewer (+ a three.js "walk inside" mode)
//   .obj/.stl/.ply/.fbx → three.js (orbit + first-person walk)
//
// This is genuinely 3D: a real 3D file someone captured (e.g. a Polycam/Luma
// room scan) rendered in a WebGL viewer you navigate like Google Maps.
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const MODELS_DIR = join(process.cwd(), 'data', 'models');
mkdirSync(MODELS_DIR, { recursive: true });

const EXT_RE = /\.(glb|gltf|obj|stl|ply|fbx|splat)$/i;
const rendererFor = (ext) => (ext === 'splat' ? 'gsplat (gaussian splat)' : (ext === 'glb' || ext === 'gltf') ? '@google/model-viewer' : 'three.js');

export async function handleModelText(message) {
  if (!/^!(3d|model)\b/i.test((message.content || '').trim())) return false;
  const att = [...message.attachments.values()].find((a) => EXT_RE.test(a.name || ''));
  if (!att) {
    await message.reply('🧊 **!3d** — drop a 3D scan/model file (`.glb .gltf .obj .stl .ply .fbx .splat`) and I’ll give you an interactive, navigate-the-room 3D viewer.').catch(() => {});
    return true;
  }
  if (att.size > 40 * 1024 * 1024) { await message.reply('⚠️ Model too big (max ~40 MB).').catch(() => {}); return true; }

  const ext = att.name.match(EXT_RE)[1].toLowerCase();
  const status = await message.reply('🧊 Preparing your 3D viewer…').catch(() => null);
  try {
    const res = await fetch(att.url);
    const buf = Buffer.from(await res.arrayBuffer());
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const fname = `${id}.${ext}`;
    writeFileSync(join(MODELS_DIR, fname), buf);

    const base = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
    const viewer = `${base}/model?src=/models/${fname}&type=${ext}&name=${encodeURIComponent(att.name)}`;
    const walkable = ext === 'glb' || ext === 'gltf' || ext === 'obj' || ext === 'stl' || ext === 'ply' || ext === 'fbx';

    const embed = new EmbedBuilder()
      .setColor(0x8b93ff)
      .setTitle('🧊 3D viewer ready')
      .setDescription(`**${att.name}** — open the viewer and **navigate like Google Maps**: drag to orbit, scroll to zoom${walkable ? ', or hit **🚶 Walk inside** to explore first-person (WASD + mouse)' : ''}.`)
      .addFields(
        { name: 'Type', value: '`.' + ext + '`', inline: true },
        { name: 'Renderer (auto-picked)', value: rendererFor(ext), inline: true },
        { name: 'Size', value: (att.size / 1048576).toFixed(1) + ' MB', inline: true },
      )
      .setFooter({ text: base ? 'Interactive 3D runs in your browser (WebGL) — the link opens it' : '⚠️ Set PUBLIC_URL so the viewer link works' });

    const payload = { content: '', embeds: [embed] };
    if (base) payload.components = [new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Open 3D viewer').setEmoji('🌐').setURL(viewer))];
    else payload.content = `Viewer path: \`/model?src=/models/${fname}&type=${ext}\` (PUBLIC_URL not set).`;
    await status?.edit(payload);
  } catch (e) { await status?.edit('⚠️ Failed to prepare viewer: ' + e.message).catch(() => {}); }
  return true;
}
