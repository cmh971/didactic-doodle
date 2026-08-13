// !tts — text-to-speech. Turns a message into an MP3 and posts it back.
//
// Engine: Google Translate's public TTS endpoint (returns real audio/mpeg).
// It caps each request at ~200 chars, so we chunk long text on word boundaries
// and concatenate the MP3 buffers (players handle back-to-back MP3 frames fine).
// Optional language: `!tts es Hola mundo`.
const TTS_URL = (text, lang) =>
  `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;

const LANGS = new Set(['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'nl', 'pl', 'tr', 'sv', 'id', 'vi', 'th']);
const MAX_CHARS = 900;
const MAX_CHUNKS = 6;

function chunk(text, size = 180) {
  const words = text.split(/\s+/);
  const out = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > size) {
      if (cur) out.push(cur.trim());
      cur = w.slice(0, size); // hard-split a single monster word
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) out.push(cur.trim());
  return out;
}

async function ttsChunk(text, lang) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 9000);
  try {
    const r = await fetch(TTS_URL(text, lang), {
      signal: ac.signal,
      headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://translate.google.com/' },
    });
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// Synthesize arbitrary text → a single concatenated MP3 Buffer (or null on failure).
// Shared by !tts (attachment) and Ash Voice (spoken in a voice channel).
export async function synthesizeTTS(text, lang = 'en') {
  const clean = String(text || '').slice(0, MAX_CHARS);
  if (!clean.trim()) return null;
  const parts = chunk(clean).slice(0, MAX_CHUNKS);
  const bufs = [];
  for (const p of parts) { const b = await ttsChunk(p, LANGS.has(lang) ? lang : 'en'); if (b) bufs.push(b); }
  return bufs.length ? Buffer.concat(bufs) : null;
}

export async function handleTtsCommand(message) {
  const m = /^!tts\b\s*([\s\S]*)$/i.exec((message.content || '').trim());
  if (!m) return false;
  let text = (m[1] || '').trim();
  if (!text) {
    await message.reply('🔊 **Text-to-speech**\nUsage: `!tts <text>` — I’ll send back an MP3.\nAnother language: `!tts es Hola mundo` (en, es, fr, de, it, pt, ru, ja, ko, zh…).').catch(() => {});
    return true;
  }

  // Optional leading 2-letter language code (only if more words follow).
  const tokens = text.split(/\s+/);
  let lang = 'en';
  if (tokens.length > 1 && LANGS.has(tokens[0].toLowerCase())) {
    lang = tokens[0].toLowerCase();
    text = tokens.slice(1).join(' ');
  }

  text = text.slice(0, MAX_CHARS);
  const parts = chunk(text).slice(0, MAX_CHUNKS);
  try {
    const bufs = [];
    for (const p of parts) {
      const b = await ttsChunk(p, lang);
      if (b) bufs.push(b);
    }
    if (!bufs.length) {
      await message.reply('⚠️ TTS failed just now — try again in a moment or shorten the text.').catch(() => {});
      return true;
    }
    const mp3 = Buffer.concat(bufs);
    await message.reply({ files: [{ attachment: mp3, name: 'tts.mp3' }] }).catch(() => {});
  } catch (e) {
    await message.reply('⚠️ TTS error: ' + e.message).catch(() => {});
  }
  return true;
}
