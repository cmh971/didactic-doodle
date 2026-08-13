// Ash Voice — the bot joins your voice channel and actually SPEAKS.
//
// Flow: synthesize text → MP3 (reusing the TTS engine) → write a temp file →
// play it through the shared @discordjs/voice helper (which auto-disconnects when
// the clip finishes). Trigger with  !ashsay <text>  while you're in a voice channel.
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import { synthesizeTTS } from './ttsText.js';
import { playFileInChannel, leaveVoice } from './voice.js';

if (ffmpegPath && !process.env.FFMPEG_PATH) process.env.FFMPEG_PATH = ffmpegPath;

const LANGS = new Set(['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'nl', 'pl', 'tr', 'sv', 'id', 'vi', 'th']);

// Reusable: synthesize `text` and speak it in voice channel `vc`. Throws on a
// missing permission or TTS failure so callers can fall back to text-only.
export async function speakInChannel(vc, text, lang = 'en') {
  const me = vc.guild.members.me;
  const perms = vc.permissionsFor(me);
  if (!perms?.has('Connect') || !perms?.has('Speak')) throw new Error('Missing Connect/Speak permission');
  const mp3 = await synthesizeTTS(text, LANGS.has(lang) ? lang : 'en');
  if (!mp3) throw new Error('TTS failed');
  const dir = path.join(os.tmpdir(), 'sentinel-tts');
  await fsp.mkdir(dir, { recursive: true });
  const file = path.join(dir, `speak-${Date.now()}.mp3`);
  await fsp.writeFile(file, mp3);
  playFileInChannel(vc, file);
  setTimeout(() => { fsp.unlink(file).catch(() => {}); }, 60000);
}

export async function handleAshVoiceCommand(message) {
  const content = (message.content || '').trim();
  if (!message.guild) return false;

  // Leave the voice channel.
  if (/^!(ashleave|vcleave|leavevc)\b/i.test(content)) {
    const ok = leaveVoice(message.guild.id);
    await message.reply(ok ? '👋 Left the voice channel.' : '🤔 I’m not in a voice channel.').catch(() => {});
    return true;
  }

  const m = /^!(ashsay|vcsay)\b\s*([\s\S]*)$/i.exec(content);
  if (!m) return false;

  let text = (m[2] || '').trim();
  if (!text) {
    await message.reply('🎙️ **Ash Voice** — join a voice channel, then `!ashsay <text>` and I’ll speak it out loud.\nOther languages: `!ashsay es Hola a todos` (en, es, fr, de, it, ja…). Leave with `!ashleave`.').catch(() => {});
    return true;
  }

  const vc = message.member?.voice?.channel;
  if (!vc) {
    await message.reply('🔇 Join a voice channel first, then try `!ashsay <text>`.').catch(() => {});
    return true;
  }
  // Make sure I can actually connect + speak there.
  const me = message.guild.members.me;
  const perms = vc.permissionsFor(me);
  if (!perms?.has('Connect') || !perms?.has('Speak')) {
    await message.reply(`🚫 I don’t have permission to **Connect** and **Speak** in **${vc.name}**.`).catch(() => {});
    return true;
  }

  // Optional leading 2-letter language code.
  const toks = text.split(/\s+/);
  let lang = 'en';
  if (toks.length > 1 && LANGS.has(toks[0].toLowerCase())) { lang = toks[0].toLowerCase(); text = toks.slice(1).join(' '); }

  await message.react('🎙️').catch(() => {});
  try {
    await speakInChannel(vc, text, lang);
    await message.reply(`🗣️ Speaking in **${vc.name}**…`).catch(() => {});
  } catch (e) {
    await message.reply('⚠️ Voice error: ' + e.message).catch(() => {});
  }
  return true;
}
