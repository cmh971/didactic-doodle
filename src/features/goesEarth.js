// ?earthhd — the NOAA GOES full-disk viewer, absolutely maxed:
//  • ALTITUDE LAYERS (⏫⏬) — real multi-band data from space → surface
//  • zoom 12× + pan + recenter · GOES-East/West · ✨ HD sharpen pipeline
//  • 🎨 colour-grade PALETTES · 📐 tactical grid overlay · 🔄 refresh
//  • 📸 4K export (current view) · 🖼️ MAX export = native 5424², tuned to sit
//    right under Discord's 8 MB limit for a jaw-on-the-floor download.
// Big 1920² in-channel view; 5424² source decoded once (single-slot cache).
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';

const SATS = { 16: 'GOES16', 18: 'GOES18' };
const LAYERS = [
  { id: 'GEOCOLOR', name: 'GeoColor — full disk from space', alt: 'Orbit · 22,236 mi up', desc: 'True-colour by day, IR clouds by night — Earth as your eye would see it.' },
  { id: '08', name: 'Upper-Level Water Vapor (Band 8)', alt: 'Upper troposphere · ~35–45,000 ft', desc: 'Moisture near the top of the weather layer — jet-stream waves ripple across it.' },
  { id: '09', name: 'Mid-Level Water Vapor (Band 9)', alt: 'Mid troposphere · ~20–30,000 ft', desc: 'Mid-level moisture — swirls trace storm systems and the atmosphere’s flow.' },
  { id: '10', name: 'Lower-Level Water Vapor (Band 10)', alt: 'Lower troposphere · ~10–20,000 ft', desc: 'Low-level moisture, closer to where weather happens.' },
  { id: '13', name: 'Clean IR — cloud tops (Band 13)', alt: 'Cloud tops · coldest = tallest', desc: 'Cloud-top temperatures — the tallest storm towers glow. Day & night.' },
  { id: '07', name: 'Shortwave IR (Band 7)', alt: 'Near surface · low cloud & fog', desc: 'Fires, hot-spots and low cloud/fog hugging the ground at night.' },
  { id: '02', name: 'Red Visible — surface (Band 2)', alt: 'Surface', desc: 'The sharpest visible channel — crisp daytime detail at the surface.' },
  { id: 'AirMass', name: 'Air Mass RGB', alt: 'Bonus · air-mass analysis', desc: 'Jet streams, dry intrusions and cyclone dynamics by air-mass type.' },
  { id: 'Sandwich', name: 'Sandwich (IR + Visible)', alt: 'Bonus · storm structure', desc: 'Visible texture fused with IR temps — thunderstorm structure pops.' },
  { id: 'FireTemperature', name: 'Fire Temperature RGB', alt: 'Bonus · wildfires', desc: 'Lights up active wildfires and how hot they’re burning.' },
  { id: 'Dust', name: 'Dust RGB', alt: 'Bonus · dust & sand', desc: 'Tracks dust and sand plumes drifting across the oceans.' },
];
const PALETTES = [
  { name: 'Natural', sat: 1.34, con: 1.12, tint: [1, 1, 1] },
  { name: 'Vivid', sat: 1.78, con: 1.18, tint: [1.05, 1.02, 1.0] },
  { name: 'Thermal', sat: 1.15, con: 1.24, tint: [1.18, 1.0, 0.82] },
  { name: 'Ocean', sat: 1.55, con: 1.10, tint: [0.92, 1.03, 1.18] },
  { name: 'Noir', sat: 0.22, con: 1.30, tint: [1, 1, 1] },
];
const INTERACTIVE = 1920;
const LIMIT = 8 * 1024 * 1024 - 256 * 1024; // stay safely under Discord's 8 MB

let cache = { key: null, img: null, at: 0 };
async function loadDisk(sat, id, force = false) {
  const name = SATS[sat] || 'GOES16';
  const key = `${name}/${id}`;
  if (!force && cache.key === key && Date.now() - cache.at < 9 * 60 * 1000) return cache.img;
  const url = `https://cdn.star.nesdis.noaa.gov/${name}/ABI/FD/${id}/5424x5424.jpg`;
  const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`That GOES layer is unavailable right now (HTTP ${r.status}).`);
  const img = await loadImage(Buffer.from(await r.arrayBuffer()));
  cache = { key, img, at: Date.now() };
  return img;
}

function enhance(g, W, H, palIdx, doSharp) {
  const P = PALETTES[palIdx] || PALETTES[0]; const [tr, tg, tb] = P.tint;
  const d = g.getImageData(0, 0, W, H); const a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    let r = (a[i] - 128) * P.con + 128, gg = (a[i + 1] - 128) * P.con + 128, b = (a[i + 2] - 128) * P.con + 128;
    const l = 0.3 * r + 0.59 * gg + 0.11 * b;
    r = (l + (r - l) * P.sat) * tr; gg = (l + (gg - l) * P.sat) * tg; b = (l + (b - l) * P.sat) * tb;
    a[i] = r < 0 ? 0 : r > 255 ? 255 : r; a[i + 1] = gg < 0 ? 0 : gg > 255 ? 255 : gg; a[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
  g.putImageData(d, 0, 0);
  if (!doSharp) return;
  const src = g.getImageData(0, 0, W, H).data; const out = g.getImageData(0, 0, W, H); const o = out.data; const rw = W * 4; const k = 0.55;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = (y * W + x) * 4;
    for (let c = 0; c < 3; c++) {
      const v = (1 + 4 * k) * src[i + c] - k * (src[i - 4 + c] + src[i + 4 + c] + src[i - rw + c] + src[i + rw + c]);
      o[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
  g.putImageData(out, 0, 0);
}

function drawGrid(g, size) {
  g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = Math.max(1, size / 1100);
  const n = 8;
  for (let i = 1; i < n; i++) { const p = size * i / n; g.beginPath(); g.moveTo(p, 0); g.lineTo(p, size); g.moveTo(0, p); g.lineTo(size, p); g.stroke(); }
  g.strokeStyle = 'rgba(255,90,90,0.65)'; g.lineWidth = Math.max(1, size / 640);
  const c = size / 2, r = size / 22;
  g.beginPath(); g.moveTo(c - r, c); g.lineTo(c + r, c); g.moveTo(c, c - r); g.lineTo(c, c + r); g.stroke();
}

function renderCanvas(img, s, size) {
  const c = createCanvas(size, size); const g = c.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.fillStyle = '#04060f'; g.fillRect(0, 0, size, size);
  const S = img.width, view = S / s.zoom;
  let sx = s.cx * S - view / 2, sy = s.cy * S - view / 2;
  sx = Math.max(0, Math.min(S - view, sx)); sy = Math.max(0, Math.min(S - view, sy));
  g.drawImage(img, sx, sy, view, view, 0, 0, size, size);
  if (s.enhance) enhance(g, size, size, s.palette, size <= 4096); // skip heavy sharpen on the giant MAX export
  if (s.grid) drawGrid(g, size);
  const sc = size / 1080;
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, size - 40 * sc, 400 * sc, 40 * sc);
  g.fillStyle = '#fff'; g.font = `bold ${Math.round(22 * sc)}px Arial`;
  g.fillText(`${s.zoom}× · ${PALETTES[s.palette].name} · ${s.enhance ? 'HD' : 'Raw'}${size >= 4096 ? (size >= 5424 ? ' · MAX' : ' · 4K') : ''}`, 14 * sc, size - 13 * sc);
  return c;
}
async function encodeUnder(canvas, limit) {
  for (const q of [96, 92, 88, 84, 80, 74, 68, 60, 52, 45]) {
    const buf = await canvas.encode('jpeg', q);
    if (buf.length <= limit) return { buf, q };
  }
  return { buf: await canvas.encode('jpeg', 40), q: 40 };
}
const renderView = (img, s) => renderCanvas(img, s, INTERACTIVE).toBuffer('image/jpeg');

function buildEmbed(s) {
  const L = LAYERS[s.layer]; const side = s.sat === 18 ? 'GOES-West' : 'GOES-East';
  return new EmbedBuilder().setColor(0x0b3d91)
    .setTitle(`🛰️ GOES-${s.sat} · ${L.name}`)
    .setDescription(
      `**📍 Altitude ${s.layer + 1}/${LAYERS.length} — ${L.alt}**\n${L.desc}\n\n` +
      `NOAA's **GOES-${s.sat}** (${side}) sits in **geostationary orbit 22,236 mi above Earth**, imaging the full ` +
      `disk every **~10 min** at **5424 × 5424** — here **colour-graded (${PALETTES[s.palette].name})** & sharpened.\n\n` +
      `⏫⏬ altitude · 🔍 zoom 12× · ⬅️⬆️⬇️➡️ pan · 🎯 recenter · 🎨 palette · 📐 grid · 🛰️ E/W · ✨ HD · 🔄 refresh\n` +
      `📸 export **4K** · 🖼️ export **MAX** (native 5424², ~8 MB)`,
    )
    .setImage('attachment://view.jpg')
    .setFooter({ text: 'NOAA STAR · GOES ABI · refreshes ~every 10 min' });
}

function controls(s) {
  const locked = s.zoom <= 1;
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('goes:zoomout').setEmoji('🔎').setStyle(ButtonStyle.Secondary).setDisabled(s.zoom <= 1),
      new ButtonBuilder().setCustomId('goes:zoomin').setEmoji('🔍').setStyle(ButtonStyle.Primary).setDisabled(s.zoom >= 12),
      new ButtonBuilder().setCustomId('goes:reset').setEmoji('♻️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('goes:enhance').setEmoji('✨').setLabel(s.enhance ? 'HD' : 'Raw').setStyle(s.enhance ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('goes:grid').setEmoji('📐').setStyle(s.grid ? ButtonStyle.Primary : ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('goes:left').setEmoji('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(locked),
      new ButtonBuilder().setCustomId('goes:up').setEmoji('⬆️').setStyle(ButtonStyle.Secondary).setDisabled(locked),
      new ButtonBuilder().setCustomId('goes:down').setEmoji('⬇️').setStyle(ButtonStyle.Secondary).setDisabled(locked),
      new ButtonBuilder().setCustomId('goes:right').setEmoji('➡️').setStyle(ButtonStyle.Secondary).setDisabled(locked),
      new ButtonBuilder().setCustomId('goes:center').setEmoji('🎯').setStyle(ButtonStyle.Secondary).setDisabled(locked),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('goes:altup').setEmoji('⏫').setLabel('Higher').setStyle(ButtonStyle.Secondary).setDisabled(s.layer <= 0),
      new ButtonBuilder().setCustomId('goes:altdown').setEmoji('⏬').setLabel('Lower').setStyle(ButtonStyle.Secondary).setDisabled(s.layer >= LAYERS.length - 1),
      new ButtonBuilder().setCustomId('goes:sat').setEmoji('🛰️').setLabel(s.sat === 18 ? 'West' : 'East').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('goes:palette').setEmoji('🎨').setLabel(PALETTES[s.palette].name).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('goes:refresh').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('goes:4k').setEmoji('📸').setLabel('4K').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('goes:max').setEmoji('🖼️').setLabel('MAX (8MB)').setStyle(ButtonStyle.Success),
    ),
  ];
}

export async function sendGoesViewer(message, arg = '') {
  const s = { sat: /18|west/i.test(arg) ? 18 : 16, layer: 0, zoom: 1, cx: 0.5, cy: 0.5, enhance: true, grid: false, palette: 0 };
  let img;
  try { img = await loadDisk(s.sat, LAYERS[s.layer].id); }
  catch (e) { await message.reply(`⚠️ ${e.message}`).catch(() => {}); return; }

  const sent = await message.reply({ embeds: [buildEmbed(s)], files: [new AttachmentBuilder(renderView(img, s), { name: 'view.jpg' })], components: controls(s) });
  const col = sent.createMessageComponentCollector({ componentType: ComponentType.Button, idle: 300000 });
  col.on('collect', async (i) => {
    await i.deferUpdate().catch(() => {});
    const act = i.customId.split(':')[1];

    if (act === '4k' || act === 'max') {
      try {
        const size = act === 'max' ? 5424 : 4096;
        const state = act === 'max' ? { ...s, enhance: true, zoom: 1, cx: 0.5, cy: 0.5 } : { ...s, enhance: true };
        const { buf, q } = await encodeUnder(renderCanvas(img, state, size), LIMIT);
        await i.followUp({
          content: `${act === 'max' ? '🖼️ **MAX export** — native **5424×5424** full disk' : `📸 **4K export** — ${LAYERS[s.layer].name}, ${s.zoom}×`} · ${(buf.length / 1048576).toFixed(1)} MB (q${q})`,
          files: [new AttachmentBuilder(buf, { name: act === 'max' ? 'earth-MAX.jpg' : 'earth-4k.jpg' })],
        }).catch(() => {});
      } catch { await i.followUp({ content: '⚠️ Export failed — try again.' }).catch(() => {}); }
      return;
    }

    const pan = 0.45 / s.zoom;
    if (act === 'zoomin') s.zoom = Math.min(12, s.zoom + 1);
    else if (act === 'zoomout') { s.zoom = Math.max(1, s.zoom - 1); if (s.zoom === 1) { s.cx = 0.5; s.cy = 0.5; } }
    else if (act === 'reset') { s.zoom = 1; s.cx = 0.5; s.cy = 0.5; }
    else if (act === 'center') { s.cx = 0.5; s.cy = 0.5; }
    else if (act === 'left') s.cx = Math.max(0.05, s.cx - pan);
    else if (act === 'right') s.cx = Math.min(0.95, s.cx + pan);
    else if (act === 'up') s.cy = Math.max(0.05, s.cy - pan);
    else if (act === 'down') s.cy = Math.min(0.95, s.cy + pan);
    else if (act === 'enhance') s.enhance = !s.enhance;
    else if (act === 'grid') s.grid = !s.grid;
    else if (act === 'palette') s.palette = (s.palette + 1) % PALETTES.length;
    else if (act === 'refresh') { try { img = await loadDisk(s.sat, LAYERS[s.layer].id, true); } catch { /* keep */ } }
    else if (act === 'sat') { s.sat = s.sat === 16 ? 18 : 16; s.zoom = 1; s.cx = 0.5; s.cy = 0.5; try { img = await loadDisk(s.sat, LAYERS[s.layer].id); } catch { /* keep */ } }
    else if (act === 'altup') { s.layer = Math.max(0, s.layer - 1); s.zoom = 1; s.cx = 0.5; s.cy = 0.5; try { img = await loadDisk(s.sat, LAYERS[s.layer].id); } catch { /* keep */ } }
    else if (act === 'altdown') { s.layer = Math.min(LAYERS.length - 1, s.layer + 1); s.zoom = 1; s.cx = 0.5; s.cy = 0.5; try { img = await loadDisk(s.sat, LAYERS[s.layer].id); } catch { /* keep */ } }

    await i.editReply({ embeds: [buildEmbed(s)], files: [new AttachmentBuilder(renderView(img, s), { name: 'view.jpg' })], components: controls(s) }).catch(() => {});
  });
  col.on('end', () => { sent.edit({ components: [] }).catch(() => {}); });
}
