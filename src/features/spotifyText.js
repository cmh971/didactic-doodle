// !spotify <query> — the music Control Center. Pulls from BOTH Spotify (when
// keys are set) AND Apple/iTunes in parallel, merges + de-dupes for max coverage,
// and lets you browse every hit with ◀️ ▶️. Each result card has:
//   ◀️ ▶️ browse · 🔊 Preview in VC · ✨ More like this · 🔁 Loop · 🎧 Open
// 30s previews fall back to iTunes when Spotify has none.
//
// 🎁 Spotify access gifted by a friend of Chris 💚
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { searchTracks, recommendations, spotifyConfigured, GIFT_CREDIT } from './spotifyApi.js';
import { searchMany, searchTrack as itunesSearch } from './spotify.js';
import { playFileInChannel, setLoop } from './voice.js';
import { extractAudioFromUrl } from './audio.js';

const GREEN = 0x1db954;
const RECENT = new Map(); // messageId -> { results:[track], idx }
function remember(id, data) { RECENT.set(id, data); if (RECENT.size > 400) RECENT.delete(RECENT.keys().next().value); }

const ms2min = (ms) => (ms ? `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}` : null);
const key = (t) => (t.name + '|' + t.artists.join(',')).toLowerCase().replace(/[^a-z0-9|]/g, '');
const unifyItunes = (t) => ({ name: t.name, artists: [t.artists], album: t.album, art: t.art, preview: t.preview, url: t.url, duration: ms2min(t.durationMs), id: null, source: 'iTunes' });

// Query both catalogues in parallel, merge (Spotify first for richer data), de-dupe.
async function mergedSearch(query) {
  const tasks = [searchMany(query, 8).then((r) => r.map(unifyItunes)).catch(() => [])];
  if (spotifyConfigured()) tasks.unshift(searchTracks(query, 8).then((r) => r.map((t) => ({ ...t, source: 'Spotify' }))).catch(() => []));
  const groups = await Promise.all(tasks);
  const seen = new Set(); const out = [];
  for (const g of groups) for (const t of g) { const k = key(t); if (seen.has(k)) continue; seen.add(k); out.push(t); }
  return out;
}

function trackEmbed(t, idx, total) {
  const e = new EmbedBuilder().setColor(GREEN)
    .setAuthor({ name: '🎵 Sentinel Music' })
    .setTitle(`${t.name}${t.explicit ? '  🅴' : ''}`)
    .setDescription(
      `**Artist:** ${t.artists.join(', ')}\n` +
      (t.album ? `**Album:** ${t.album}\n` : '') +
      (t.duration ? `**Length:** ${t.duration}\n` : '') +
      (t.popularity != null ? `**Popularity:** ${'▰'.repeat(Math.round(t.popularity / 10))}${'▱'.repeat(10 - Math.round(t.popularity / 10))} ${t.popularity}\n` : '') +
      (t.release ? `**Released:** ${t.release}\n` : '') +
      (t.preview ? '' : '\n_No 30s preview on this source — I’ll try the other one._'),
    )
    .setFooter({ text: `${GIFT_CREDIT}  ·  result ${idx + 1}/${total} · via ${t.source}` });
  if (t.art) e.setThumbnail(t.art);
  if (t.url) e.setURL(t.url);
  return e;
}
function controls(t, total) {
  const many = total > 1;
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sp:prev').setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(!many),
    new ButtonBuilder().setCustomId('sp:next').setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(!many),
    new ButtonBuilder().setCustomId('sp:preview').setLabel('Preview in VC').setEmoji('🔊').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('sp:loop').setEmoji('🔁').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sp:rec').setLabel('More like this').setEmoji('✨').setStyle(ButtonStyle.Primary),
  );
  const rows = [row1];
  if (t.url) rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Open').setEmoji('🎧').setStyle(ButtonStyle.Link).setURL(t.url)));
  return rows;
}

async function previewUrl(t) {
  if (t.preview) return t.preview;
  try { const it = await itunesSearch(`${t.name} ${t.artists[0] || ''}`.trim()); return it?.preview || null; } catch { return null; }
}

export async function handleSpotifyText(message) {
  const raw = (message.content || '').trim();
  if (!/^!(spotify|sp)\b/i.test(raw) || !message.guild) return false;
  const query = raw.replace(/^!(spotify|sp)\b/i, '').trim();
  if (!query) { await message.reply('🎵 Usage: `!spotify <song / artist>` — searches Spotify + Apple for max results, previews in VC, and more.').catch(() => {}); return true; }

  await message.channel.sendTyping?.().catch(() => {});
  let results;
  try { results = await mergedSearch(query); } catch (e) { await message.reply(`⚠️ Search failed: ${e.message}`).catch(() => {}); return true; }
  if (!results.length) { await message.reply(`🔍 Nothing found for **${query}**.`).catch(() => {}); return true; }

  const t = results[0];
  const sent = await message.reply({ embeds: [trackEmbed(t, 0, results.length)], components: controls(t, results.length) }).catch(() => null);
  if (sent) remember(sent.id, { results, idx: 0 });
  return true;
}

export async function handleSpotifyButton(interaction) {
  if (!interaction.customId?.startsWith('sp:')) return false;
  const action = interaction.customId.split(':')[1];
  const data = RECENT.get(interaction.message.id);
  if (!data) { await interaction.reply({ content: '⌛ This player expired — run `!spotify <song>` again.', flags: MessageFlags.Ephemeral }).catch(() => {}); return true; }
  const { results } = data;
  const cur = results[data.idx];

  if (action === 'prev' || action === 'next') {
    data.idx = (data.idx + (action === 'next' ? 1 : -1) + results.length) % results.length;
    const t = results[data.idx];
    await interaction.update({ embeds: [trackEmbed(t, data.idx, results.length)], components: controls(t, results.length) }).catch(() => {});
    return true;
  }

  if (action === 'loop') {
    const st = setLoop(interaction.guildId);
    await interaction.reply({ content: st === null ? 'ℹ️ Nothing’s playing in VC yet — hit **Preview in VC** first.' : (st ? '🔁 Loop **ON** — the preview will repeat.' : '➡️ Loop **OFF**.'), flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }

  if (action === 'preview') {
    const vc = interaction.member?.voice?.channel;
    if (!vc) { await interaction.reply({ content: '🔊 Join a voice channel first, then hit Preview.', flags: MessageFlags.Ephemeral }).catch(() => {}); return true; }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
    const url = await previewUrl(cur);
    if (!url) { await interaction.editReply('😕 No 30-second preview exists for this track on either source.').catch(() => {}); return true; }
    try {
      const { path } = await extractAudioFromUrl(url, `${cur.name}.mp3`);
      playFileInChannel(vc, path);
      await interaction.editReply(`🔊 Playing a 30s preview of **${cur.name}** in **${vc.name}**. \`!media loop\` to repeat · \`!media stop\` to stop.`).catch(() => {});
    } catch (e) { await interaction.editReply(`⚠️ Couldn’t play the preview: ${e.message}`).catch(() => {}); }
    return true;
  }

  if (action === 'rec') {
    if (!spotifyConfigured() || !cur.id) { await interaction.reply({ content: '✨ Recommendations need the Spotify keys in `.env` — add them and try again!', flags: MessageFlags.Ephemeral }).catch(() => {}); return true; }
    await interaction.deferReply().catch(() => {});
    try {
      const recs = await recommendations(cur.id, 5);
      if (!recs.length) { await interaction.editReply('No recommendations came back for that one.').catch(() => {}); return true; }
      const e = new EmbedBuilder().setColor(GREEN).setTitle(`✨ More like “${cur.name}”`)
        .setDescription(recs.map((r, i) => `**${i + 1}.** [${r.name}](${r.url}) — ${r.artists.join(', ')}`).join('\n'))
        .setFooter({ text: GIFT_CREDIT });
      if (recs[0].art) e.setThumbnail(recs[0].art);
      await interaction.editReply({ embeds: [e] }).catch(() => {});
    } catch (err) { await interaction.editReply(`⚠️ ${err.message}`).catch(() => {}); }
    return true;
  }
  return false;
}
