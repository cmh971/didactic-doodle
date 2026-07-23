// The !media prefix hub — audio tools that don't eat a slash-command slot
// (we're at Discord's 100 top-level cap). Mirrors the style of !fight / !setup.
//   !media extract           attach a video → get the audio as mp3
//   !media play [name]       attach a file OR name a saved track → play in your VC
//   !media stop              leave the voice channel
//   !media spotify <song>    search Spotify (info + 30s preview)
//   !media list              your extracted tracks
import { EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { statSync } from 'node:fs';
import { extractAudioFromUrl, resolveTrack, listAudio } from './audio.js';
import { playFileInChannel, leaveVoice } from './voice.js';
import { searchTrack, spotifyEnabled } from './spotify.js';

const MAX_UPLOAD = 24 * 1024 * 1024;
const HELP =
  '🎧 **!media hub**\n' +
  '• `!media extract` — attach a video/clip → get just the audio (mp3)\n' +
  '• `!media play` — attach an audio/video, **or** `!media play <trackname>` → plays in your voice channel\n' +
  '• `!media stop` — leave the voice channel\n' +
  '• `!media music <song>` — search music (info + 30-second preview, free, no account)\n' +
  '• `!media list` — list your extracted tracks';

export async function handleMediaText(message) {
  const raw = (message.content || '').trim();
  if (!/^!media\b/i.test(raw)) return false;
  const parts = raw.split(/\s+/);
  const sub = (parts[1] || '').toLowerCase();
  const rest = parts.slice(2).join(' ').trim();

  if (!sub || sub === 'help') { await message.reply(HELP).catch(() => {}); return true; }

  // ---- extract audio from an attached video ----
  if (sub === 'extract' || sub === 'extractaudio') {
    const att = message.attachments.first();
    if (!att) { await message.reply('❌ Attach a video/clip to your message, then send `!media extract`.').catch(() => {}); return true; }
    const status = await message.reply('🎬 Extracting audio…').catch(() => null);
    try {
      const { path, name } = await extractAudioFromUrl(att.url, att.name);
      const size = statSync(path).size;
      const mb = (size / 1048576).toFixed(1);
      if (size <= MAX_UPLOAD) {
        await status?.edit({ content: `🎧 Done — **${name}** (${mb} MB). Saved to your dashboard → Audio too.`, files: [new AttachmentBuilder(path, { name })] });
      } else {
        await status?.edit(`🎧 Done — **${name}** (${mb} MB). Too big to attach — grab it on the **dashboard → Audio**, or \`!media play ${name}\`.`);
      }
    } catch (err) { await status?.edit(`⚠️ Couldn’t extract: ${err.message}`); }
    return true;
  }

  // ---- play in the caller's voice channel ----
  if (sub === 'play') {
    const channel = message.member?.voice?.channel;
    if (!channel) { await message.reply('❌ Join a voice channel first, then `!media play`.').catch(() => {}); return true; }
    const att = message.attachments.first();
    try {
      let path;
      let label;
      if (att) {
        const out = await extractAudioFromUrl(att.url, att.name); // strips video, normalizes to mp3
        path = out.path; label = att.name;
      } else if (rest) {
        path = resolveTrack(rest); label = rest;
        if (!path) { await message.reply(`❌ No saved track called \`${rest}\`. Try \`!media list\`.`).catch(() => {}); return true; }
      } else {
        await message.reply('❌ Attach a file, or name a saved track: `!media play <name>`.').catch(() => {}); return true;
      }
      playFileInChannel(channel, path);
      await message.reply(`🔊 Now playing **${label}** in **${channel.name}**. Use \`!media stop\` to stop.`).catch(() => {});
    } catch (err) { await message.reply(`⚠️ Couldn’t play that: ${err.message}`).catch(() => {}); }
    return true;
  }

  if (sub === 'stop') {
    const left = leaveVoice(message.guild.id);
    await message.reply(left ? '⏹️ Stopped and left the voice channel.' : 'ℹ️ I’m not in a voice channel here.').catch(() => {});
    return true;
  }

  if (sub === 'list') {
    const tracks = listAudio();
    await message.reply(tracks.length
      ? '🎵 **Your tracks:**\n' + tracks.slice(0, 15).map((t) => `• \`${t.name}\``).join('\n')
      : 'No extracted tracks yet — run `!media extract` on a video.').catch(() => {});
    return true;
  }

  // ---- Music metadata (search + 30s preview, via free iTunes API) ----
  if (sub === 'music' || sub === 'song' || sub === 'spotify' || sub === 'sp') {
    if (!rest) { await message.reply('❌ Usage: `!media music <song / artist>`').catch(() => {}); return true; }
    try {
      const s = await searchTrack(rest);
      if (!s) { await message.reply('🔍 No tracks found for that.').catch(() => {}); return true; }
      const embed = new EmbedBuilder()
        .setColor(0xfa2d48)
        .setTitle(`🎵 ${s.name}`)
        .setDescription(`by **${s.artists}**`)
        .addFields(
          { name: 'Album', value: s.album || '—', inline: true },
          { name: '30s preview', value: s.preview ? `[▶️ Listen](${s.preview})` : '_none available_', inline: true },
        )
        .setFooter({ text: 'Music search • 30s preview (free, no account needed)' });
      if (s.art) embed.setThumbnail(s.art);
      await message.reply({ embeds: [embed] }).catch(() => {});
    } catch (err) { await message.reply(`⚠️ Music search error: ${err.message}`).catch(() => {}); }
    return true;
  }

  await message.reply('❓ Unknown `!media` command. Try `!media help`.').catch(() => {});
  return true;
}
