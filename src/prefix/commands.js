// ============================================================================
// The "?" command pack. Lightweight, self-contained utility/fun/text/math
// commands that run on the "?" prefix (e.g. ?reverse hello). They don't register
// as slash commands, so they don't count against Discord's 100 top-level cap —
// which is how we grow the command count without breaking registration.
//
// Each command: { name, aliases?, category, description, run(ctx) -> string|void }
// ctx = { args (string after the name), argv (whitespace split), message }
// A returned string is sent as a reply; commands may also reply themselves.
// ============================================================================

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, AttachmentBuilder } from 'discord.js';
import * as api from '../features/funApis.js';
import { renderQuakeCard, renderNeoCard } from '../features/apiCards.js';
import { speakInChannel } from '../features/ashVoice.js';
import { sendGoesViewer } from '../features/goesEarth.js';
import { sendEarthSpin } from '../features/earthSpin.js';
import { sendCinematicEarth } from '../features/earthCinematic.js';
import { getProfile, clearProfile } from '../ai/ashMemory.js';
import { renderWheel, renderLottery, heistCommand } from '../features/events.js';
import { getBadges, BADGES } from '../features/badges.js';
import { buildRecapEmbed } from '../features/weeklyRecap.js';
import { getCfg } from '../setup/store.js';

const casinoOff = (message) => (getCfg(message.guild.id).settings.casino?.enabled === false)
  ? '🎰 The casino is currently **disabled** on this server. (An admin can enable it in `/setup → Casino`.)' : null;

const showBadges = (guildId, userId, who) => {
  const earned = getBadges(guildId, userId);
  if (!earned.length) return `🎖️ ${who} hasn't unlocked any badges yet. Level up, win a heist, or hit the wheel jackpot!`;
  const total = Object.keys(BADGES).length;
  return `🎖️ **${who}'s badges** (${earned.length}/${total})\n` + earned.map((b) => `${b.emoji} **${b.name}** — ${b.desc}`).join('\n');
};

const showProfile = (guildId, userId, who) => {
  const p = getProfile(guildId, userId);
  if (!p || !p.facts.length) return null;
  return `🧠 **What Ash remembers about ${who}:**\n${p.facts.map((f) => `• ${f}`).join('\n')}`;
};

const rint = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const need = (s, usage) => { if (!s || !s.trim()) throw new Error(`Usage: \`${usage}\``); return s.trim(); };
const nums = (argv) => argv.map(Number).filter((n) => !Number.isNaN(n));
// helpers for the expansion pack (ciphers, styles, math)
const caesar = (s, n) => s.replace(/[a-z]/gi, (c) => { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode((c.charCodeAt(0) - b + ((n % 26) + 26)) % 26 + b); });
const atbash = (s) => s.replace(/[a-z]/gi, (c) => { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode(b + 25 - (c.charCodeAt(0) - b)); });
const strike = (s) => [...s].map((c) => c + '̶').join('');
const underline = (s) => [...s].map((c) => c + '̲').join('');
const NATO = { a: 'Alpha', b: 'Bravo', c: 'Charlie', d: 'Delta', e: 'Echo', f: 'Foxtrot', g: 'Golf', h: 'Hotel', i: 'India', j: 'Juliett', k: 'Kilo', l: 'Lima', m: 'Mike', n: 'November', o: 'Oscar', p: 'Papa', q: 'Quebec', r: 'Romeo', s: 'Sierra', t: 'Tango', u: 'Uniform', v: 'Victor', w: 'Whiskey', x: 'X-ray', y: 'Yankee', z: 'Zulu' };
const need2 = (argv, n, usage) => { if (nums(argv).length < n) throw new Error(`Usage: \`${usage}\``); return nums(argv); };
const round = (n, d = 2) => { const p = 10 ** d; return Math.round(n * p) / p; };
// conversion command factory — one line per real unit conversion
const CONV = (name, from, to, fn, icon = '📐') => ({ name, category: 'qconv', description: `${from} → ${to}`, run: ({ argv }) => { const [n] = nums(argv); if (n == null) throw new Error(`Usage: \`?${name} <number>\``); return `${icon} ${n} ${from} = **${round(fn(n), 4)} ${to}**`; } });
const vig = (s, key, dir = 1) => { key = String(key).toLowerCase().replace(/[^a-z]/g, ''); if (!key) return s; let ki = 0; return s.replace(/[a-z]/gi, (c) => { const b = c <= 'Z' ? 65 : 97; const k = key.charCodeAt(ki++ % key.length) - 97; return String.fromCharCode((c.charCodeAt(0) - b + dir * k + 26) % 26 + b); }); };
const BRAILLE = '⠁⠃⠉⠙⠑⠋⠛⠓⠊⠚⠅⠇⠍⠝⠕⠏⠟⠗⠎⠞⠥⠧⠺⠭⠽⠵';

const MORSE = { a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.' };
const UNMORSE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
const ROMANS = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];

const COMMANDS = [
  // ---------------- TEXT (category: qtext) ----------------
  { name: 'reverse', category: 'qtext', description: 'Reverse your text', run: ({ args }) => [...need(args, '?reverse <text>')].reverse().join('') },
  { name: 'upper', category: 'qtext', description: 'UPPERCASE your text', run: ({ args }) => need(args, '?upper <text>').toUpperCase() },
  { name: 'lower', category: 'qtext', description: 'lowercase your text', run: ({ args }) => need(args, '?lower <text>').toLowerCase() },
  { name: 'title', category: 'qtext', description: 'Title Case Your Text', run: ({ args }) => need(args, '?title <text>').replace(/\b\w/g, (c) => c.toUpperCase()) },
  { name: 'clap', category: 'qtext', description: '👏 Put 👏 claps 👏 between 👏 words', run: ({ args }) => need(args, '?clap <text>').split(/\s+/).join(' 👏 ') },
  { name: 'mock', category: 'qtext', description: 'sPoNgEbOb mOcKiNg text', run: ({ args }) => [...need(args, '?mock <text>')].map((c, i) => (i % 2 ? c.toUpperCase() : c.toLowerCase())).join('') },
  { name: 'owo', aliases: ['owoify'], category: 'qtext', description: 'OwO-ify your text', run: ({ args }) => need(args, '?owo <text>').replace(/[rl]/g, 'w').replace(/[RL]/g, 'W').replace(/n([aeiou])/g, 'ny$1') + ' owo' },
  { name: 'vaporwave', aliases: ['aesthetic'], category: 'qtext', description: 'Ｆｕｌｌ－ｗｉｄｔｈ aesthetic', run: ({ args }) => [...need(args, '?vaporwave <text>')].map((c) => { const code = c.charCodeAt(0); return code >= 33 && code <= 126 ? String.fromCharCode(code + 0xfee0) : c === ' ' ? '　' : c; }).join('') },
  { name: 'spacer', aliases: ['space'], category: 'qtext', description: 's p a c e out text', run: ({ args }) => [...need(args, '?spacer <text>')].join(' ') },
  { name: 'leet', category: 'qtext', description: 'Convert to l33t sp34k', run: ({ args }) => need(args, '?leet <text>').replace(/[aeiost]/gi, (c) => ({ a: '4', e: '3', i: '1', o: '0', s: '5', t: '7' })[c.toLowerCase()]) },
  { name: 'rot13', category: 'qtext', description: 'ROT13 cipher a message', run: ({ args }) => need(args, '?rot13 <text>').replace(/[a-z]/gi, (c) => String.fromCharCode((c <= 'Z' ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26)) },
  { name: 'binary', category: 'qtext', description: 'Text → binary', run: ({ args }) => [...need(args, '?binary <text>')].map((c) => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ') },
  { name: 'unbinary', category: 'qtext', description: 'Binary → text', run: ({ args }) => need(args, '?unbinary <bits>').trim().split(/\s+/).map((b) => String.fromCharCode(parseInt(b, 2))).join('') },
  { name: 'morse', category: 'qtext', description: 'Text → Morse code', run: ({ args }) => [...need(args, '?morse <text>').toLowerCase()].map((c) => (c === ' ' ? '/' : MORSE[c] ?? '')).join(' ').trim() },
  { name: 'unmorse', category: 'qtext', description: 'Morse code → text', run: ({ args }) => need(args, '?unmorse <morse>').trim().split(' ').map((s) => (s === '/' ? ' ' : UNMORSE[s] ?? '')).join('') },
  { name: 'emojiletters', aliases: ['emojify'], category: 'qtext', description: 'Turn letters into 🇦 emoji letters', run: ({ args }) => [...need(args, '?emojiletters <text>').toLowerCase()].map((c) => (/[a-z]/.test(c) ? String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 97) + ' ' : c === ' ' ? '   ' : c)).join('') },
  { name: 'redact', category: 'qtext', description: '█████ redact your text', run: ({ args }) => need(args, '?redact <text>').replace(/\S/g, '█') },
  { name: 'reverwords', aliases: ['reversewords'], category: 'qtext', description: 'Reverse the word order', run: ({ args }) => need(args, '?reverwords <text>').split(/\s+/).reverse().join(' ') },
  { name: 'count', aliases: ['wc'], category: 'qtext', description: 'Count characters & words', run: ({ args }) => { const s = need(args, '?count <text>'); return `📊 ${[...s].length} characters, ${s.trim().split(/\s+/).length} words.`; } },

  // ---------------- ASH AI MEMORY (category: qai) ----------------
  { name: 'aboutme', aliases: ['whatyouknow', 'mymemory'], category: 'qai', description: 'See what the AI (Ash) remembers about you', run: ({ message }) => {
    if (!message.guild) return 'Use this in a server.';
    return showProfile(message.guild.id, message.author.id, 'you') || "🤖 Ash doesn't know anything about you yet. Chat with `/ask` and it'll start remembering!";
  } },
  { name: 'whois', aliases: ['profile', 'aboutuser'], category: 'qai', description: 'See what Ash remembers about a member — ?whois @user', run: ({ message }) => {
    if (!message.guild) return 'Use this in a server.';
    const target = message.mentions?.users?.first();
    if (!target) return showProfile(message.guild.id, message.author.id, 'you') || '🤖 Mention someone: `?whois @user`';
    return showProfile(message.guild.id, target.id, target.username) || `🤖 Ash doesn't know anything about **${target.username}** yet.`;
  } },
  { name: 'forgetme', aliases: ['ashforget'], category: 'qai', description: 'Make Ash forget everything it knows about you', run: ({ message }) => {
    if (!message.guild) return 'Use this in a server.';
    clearProfile(message.guild.id, message.author.id);
    return '🧹 Done — Ash has wiped everything it knew about you. Fresh slate. 🫧';
  } },

  // ---------------- SERVER EVENTS / CASINO (category: qcasino) ----------------
  { name: 'wheel', aliases: ['spin', 'dailyspin'], category: 'qcasino', description: 'Spin the daily prize wheel (once every 24h)', run: ({ message }) => {
    if (!message.guild) return 'Use this in a server.';
    return casinoOff(message) || renderWheel(message.guild.id, message.author.id, message.member?.displayName || message.author.username);
  } },
  { name: 'badges', aliases: ['achievements', 'badge'], category: 'qcasino', description: 'See your unlocked achievement badges — ?badges [@user]', run: ({ message }) => {
    if (!message.guild) return 'Use this in a server.';
    const target = message.mentions?.users?.first();
    if (target) return showBadges(message.guild.id, target.id, target.username);
    return showBadges(message.guild.id, message.author.id, 'Your');
  } },
  { name: 'recap', aliases: ['weekly', 'weekrecap'], category: 'qcasino', description: 'This server’s weekly recap — messages, growth, top members', run: async ({ message }) => {
    if (!message.guild) return 'Use this in a server.';
    await message.channel.send({ embeds: [buildRecapEmbed(message.client, message.guild.id)] }).catch(() => {});
  } },

  // ================= EXPANSION PACK → 700 commands =================
  // ---- more TEXT (qtext2) ----
  { name: 'slug', category: 'qtext2', description: 'Slugify text (my-post-title)', run: ({ args }) => need(args, '?slug <text>').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') },
  { name: 'camel', category: 'qtext2', description: 'camelCase your text', run: ({ args }) => need(args, '?camel <text>').toLowerCase().replace(/[^a-z0-9]+(.)/g, (_, c) => c.toUpperCase()) },
  { name: 'snake', category: 'qtext2', description: 'snake_case your text', run: ({ args }) => need(args, '?snake <text>').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') },
  { name: 'kebab', category: 'qtext2', description: 'kebab-case your text', run: ({ args }) => need(args, '?kebab <text>').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') },
  { name: 'shout', category: 'qtext2', description: 'SHOUT YOUR TEXT!!!', run: ({ args }) => need(args, '?shout <text>').toUpperCase() + '!!!' },
  { name: 'piglatin', aliases: ['pig'], category: 'qtext2', description: 'Translate to Pig Latin', run: ({ args }) => need(args, '?piglatin <text>').split(/\s+/).map((w) => /^[aeiou]/i.test(w) ? w + 'way' : w.replace(/^([^aeiou]+)(.*)/i, '$2$1ay')).join(' ') },
  { name: 'vowels', category: 'qtext2', description: 'Count the vowels', run: ({ args }) => `🔤 ${(need(args, '?vowels <text>').match(/[aeiou]/gi) || []).length} vowels.` },
  { name: 'acronym', category: 'qtext2', description: 'Make an acronym from words', run: ({ args }) => need(args, '?acronym <words>').split(/\s+/).map((w) => w[0]?.toUpperCase() || '').join('') },
  { name: 'novowels', aliases: ['disemvowel'], category: 'qtext2', description: 'Remove all vowels', run: ({ args }) => need(args, '?novowels <text>').replace(/[aeiou]/gi, '') },
  { name: 'stutter', category: 'qtext2', description: 'A-add a s-stutter', run: ({ args }) => need(args, '?stutter <text>').split(/\s+/).map((w) => w.length > 1 ? `${w[0]}-${w}` : w).join(' ') },
  { name: 'ascii', category: 'qtext2', description: 'Text → ASCII codes', run: ({ args }) => [...need(args, '?ascii <text>')].map((c) => c.charCodeAt(0)).join(' ') },
  { name: 'wordlen', aliases: ['longest'], category: 'qtext2', description: 'Find the longest word', run: ({ args }) => { const w = need(args, '?wordlen <text>').split(/\s+/).sort((a, b) => b.length - a.length)[0]; return `📏 Longest word: **${w}** (${w.length})`; } },

  // ---- more MATH (qmath2) ----
  { name: 'factorial', aliases: ['fact!'], category: 'qmath2', description: 'n! factorial', run: ({ argv }) => { const [n] = nums(argv); if (n == null || n < 0 || n > 170) throw new Error('Usage: `?factorial 5` (0–170)'); let r = 1; for (let i = 2; i <= n; i++) r *= i; return `🧮 ${n}! = **${r}**`; } },
  { name: 'fib', category: 'qmath2', description: 'Nth Fibonacci number', run: ({ argv }) => { const [n] = nums(argv); if (n == null || n < 0 || n > 78) throw new Error('Usage: `?fib 10` (0–78)'); let a = 0, b = 1; for (let i = 0; i < n; i++) [a, b] = [b, a + b]; return `🔢 fib(${n}) = **${a}**`; } },
  { name: 'isprime', category: 'qmath2', description: 'Is a number prime?', run: ({ argv }) => { const [n] = nums(argv); if (n == null) throw new Error('Usage: `?isprime 17`'); let p = n > 1; for (let i = 2; i * i <= n; i++) if (n % i === 0) { p = false; break; } return `${p ? '✅' : '❌'} ${n} is ${p ? '' : 'not '}prime.`; } },
  { name: 'gcd', category: 'qmath2', description: 'Greatest common divisor', run: ({ argv }) => { let [a, b] = nums(argv); if (a == null || b == null) throw new Error('Usage: `?gcd 12 18`'); a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return `➗ gcd = **${a}**`; } },
  { name: 'lcm', category: 'qmath2', description: 'Least common multiple', run: ({ argv }) => { let [a, b] = nums(argv); if (!a || !b) throw new Error('Usage: `?lcm 4 6`'); let x = Math.abs(a), y = Math.abs(b); while (y) [x, y] = [y, x % y]; return `🔗 lcm = **${Math.abs(a * b) / x}**`; } },
  { name: 'sqrt', category: 'qmath2', description: 'Square root', run: ({ argv }) => { const [n] = nums(argv); if (n == null || n < 0) throw new Error('Usage: `?sqrt 144`'); return `√${n} = **${Math.sqrt(n)}**`; } },
  { name: 'pow', category: 'qmath2', description: 'a to the power b', run: ({ argv }) => { const [a, b] = nums(argv); if (a == null || b == null) throw new Error('Usage: `?pow 2 10`'); return `⚡ ${a}^${b} = **${Math.pow(a, b)}**`; } },
  { name: 'hex2dec', category: 'qmath2', description: 'Hex → decimal', run: ({ args }) => { const n = parseInt(need(args, '?hex2dec ff').replace(/^#|0x/i, ''), 16); if (Number.isNaN(n)) throw new Error('Not valid hex.'); return `🔢 = **${n}**`; } },
  { name: 'dec2hex', category: 'qmath2', description: 'Decimal → hex', run: ({ argv }) => { const [n] = nums(argv); if (n == null) throw new Error('Usage: `?dec2hex 255`'); return `🔢 = **0x${n.toString(16).toUpperCase()}**`; } },
  { name: 'dec2bin', category: 'qmath2', description: 'Decimal → binary', run: ({ argv }) => { const [n] = nums(argv); if (n == null) throw new Error('Usage: `?dec2bin 10`'); return `🔢 = **${n.toString(2)}**`; } },
  { name: 'bin2dec', category: 'qmath2', description: 'Binary → decimal', run: ({ args }) => { const n = parseInt(need(args, '?bin2dec 1010'), 2); if (Number.isNaN(n)) throw new Error('Not valid binary.'); return `🔢 = **${n}**`; } },
  { name: 'tip', category: 'qmath2', description: '?tip <bill> <pct> — tip amount', run: ({ argv }) => { const [b, p] = nums(argv); if (b == null || p == null) throw new Error('Usage: `?tip 50 20`'); return `💵 Tip: **${(b * p / 100).toFixed(2)}** · Total: **${(b * (1 + p / 100)).toFixed(2)}**`; } },
  { name: 'bmi', category: 'qmath2', description: '?bmi <kg> <m> — body mass index', run: ({ argv }) => { const [kg, m] = nums(argv); if (!kg || !m) throw new Error('Usage: `?bmi 70 1.75`'); return `⚖️ BMI = **${(kg / (m * m)).toFixed(1)}**`; } },
  { name: 'km2mi', category: 'qmath2', description: 'Kilometers → miles', run: ({ argv }) => { const [k] = nums(argv); if (k == null) throw new Error('Usage: `?km2mi 5`'); return `📏 ${k} km = **${(k * 0.621371).toFixed(2)} mi**`; } },
  { name: 'kg2lb', category: 'qmath2', description: 'Kilograms → pounds', run: ({ argv }) => { const [k] = nums(argv); if (k == null) throw new Error('Usage: `?kg2lb 80`'); return `⚖️ ${k} kg = **${(k * 2.20462).toFixed(1)} lb**`; } },
  { name: 'lb2kg', category: 'qmath2', description: 'Pounds → kilograms', run: ({ argv }) => { const [l] = nums(argv); if (l == null) throw new Error('Usage: `?lb2kg 150`'); return `⚖️ ${l} lb = **${(l / 2.20462).toFixed(1)} kg**`; } },
  { name: 'ft2m', category: 'qmath2', description: 'Feet → meters', run: ({ argv }) => { const [f] = nums(argv); if (f == null) throw new Error('Usage: `?ft2m 6`'); return `📏 ${f} ft = **${(f * 0.3048).toFixed(2)} m**`; } },

  // ---- FUN & RANDOM (qfun) ----
  { name: '8ball', aliases: ['8b'], category: 'qfun', description: 'Ask the magic 8-ball', run: ({ args }) => { need(args, '?8ball <question>'); return '🎱 ' + pick(['It is certain.', 'Without a doubt.', 'Yes, definitely.', 'Most likely.', 'Ask again later.', 'Cannot predict now.', 'Don’t count on it.', 'My reply is no.', 'Very doubtful.', 'Signs point to yes.']); } },
  { name: 'coinflip', aliases: ['flip', 'coin'], category: 'qfun', description: 'Flip a coin', run: () => `🪙 **${pick(['Heads', 'Tails'])}**!` },
  { name: 'rps', category: 'qfun', description: '?rps <rock|paper|scissors>', run: ({ args }) => { const me = pick(['rock', 'paper', 'scissors']); const you = need(args, '?rps rock').toLowerCase().trim(); if (!['rock', 'paper', 'scissors'].includes(you)) throw new Error('Pick rock, paper, or scissors.'); const win = { rock: 'scissors', paper: 'rock', scissors: 'paper' }; const r = you === me ? 'Tie!' : win[you] === me ? 'You win! 🎉' : 'I win! 😎'; return `✊ You: **${you}** · Me: **${me}** → ${r}`; } },
  { name: 'choose', aliases: ['pick', 'decide'], category: 'qfun', description: '?choose a, b, c — I pick one', run: ({ args }) => { const opts = need(args, '?choose pizza, tacos').split(/,|\bor\b/).map((s) => s.trim()).filter(Boolean); if (opts.length < 2) throw new Error('Give me 2+ options separated by commas.'); return `🤔 I choose: **${pick(opts)}**`; } },
  { name: 'rate', category: 'qfun', description: 'I rate anything /10', run: ({ args }) => `📊 I rate **${need(args, '?rate <thing>')}** a **${rint(1, 10)}/10**.` },
  { name: 'ship', category: 'qfun', description: '?ship <a> <b> — love calculator', run: ({ argv }) => { if (argv.length < 2) throw new Error('Usage: `?ship Alice Bob`'); return `💘 **${argv[0]}** + **${argv[1]}** = **${rint(0, 100)}%** match!`; } },
  { name: 'iq', category: 'qfun', description: 'Estimate someone’s IQ (for fun)', run: ({ args }) => `🧠 **${need(args, '?iq <name>')}** has an IQ of **${rint(60, 160)}**.` },
  { name: 'fact', aliases: ['randomfact'], category: 'qfun', description: 'A random fun fact', run: () => '💡 ' + pick(['Honey never spoils.', 'Octopuses have three hearts.', 'Bananas are berries; strawberries aren’t.', 'A day on Venus is longer than its year.', 'Wombat poop is cube-shaped.', 'Sharks existed before trees.', 'There are more stars than grains of sand on Earth.']) },
  { name: 'advice', category: 'qfun', description: 'Get random advice', run: () => '🧭 ' + pick(['Drink some water.', 'Take the break — you’ve earned it.', 'Message that friend you’ve been meaning to.', 'Sleep on big decisions.', 'Done is better than perfect.', 'Touch grass. 🌱']) },
  { name: 'quote', category: 'qfun', description: 'An inspiring quote', run: () => '💬 ' + pick(['“The best time to plant a tree was 20 years ago. The second best is now.”', '“Done is better than perfect.”', '“Fall seven times, stand up eight.”', '“What you do speaks so loudly I cannot hear what you say.”']) },
  { name: 'dadjoke', category: 'qfun', description: 'A groan-worthy dad joke', run: () => '👨 ' + pick(['I’m afraid for the calendar. Its days are numbered.', 'Why don’t skeletons fight? They don’t have the guts.', 'I only know 25 letters of the alphabet. I don’t know y.', 'What do you call fake spaghetti? An impasta.']) },
  { name: 'riddle', category: 'qfun', description: 'A riddle (answer hidden)', run: () => { const r = pick([['What has keys but can’t open locks?', 'A piano'], ['What gets wetter as it dries?', 'A towel'], ['What has hands but can’t clap?', 'A clock']]); return `🧩 ${r[0]}\n||Answer: ${r[1]}||`; } },
  { name: 'fortune', aliases: ['cookie'], category: 'qfun', description: 'Crack a fortune cookie', run: () => '🥠 ' + pick(['A pleasant surprise is waiting for you.', 'Your hard work is about to pay off.', 'Good news will come to you by mail.', 'A thrilling time is in your near future.']) },
  { name: 'yesno', category: 'qfun', description: 'A definitive yes or no', run: () => pick(['✅ Yes.', '❌ No.', '🤷 Maybe.', '💯 Absolutely.', '🚫 Absolutely not.']) },
  { name: 'vibe', aliases: ['vibecheck'], category: 'qfun', description: 'Check your vibe', run: ({ message }) => `✨ ${message.member?.displayName || message.author.username}’s vibe: **${rint(1, 100)}%** immaculate.` },
  { name: 'mood', category: 'qfun', description: 'Your current mood', run: () => 'Today’s mood: ' + pick(['😎 unbothered', '🔥 locked in', '😴 sleepy', '🤡 chaotic', '🥲 emotional', '🚀 unstoppable']) },
  { name: 'wyr', category: 'qfun', description: 'Would you rather…', run: () => '🤔 Would you rather ' + pick(['have unlimited money or unlimited time?', 'fly or be invisible?', 'never use social media again or never watch TV again?', 'fight one horse-sized duck or 100 duck-sized horses?']) },
  { name: 'truth', category: 'qfun', description: 'Truth (for truth-or-dare)', run: () => '🗣️ ' + pick(['What’s your most embarrassing moment?', 'Who was your first crush?', 'What’s a secret talent you have?', 'What’s the last lie you told?']) },
  { name: 'dare', category: 'qfun', description: 'Dare (for truth-or-dare)', run: () => '😈 ' + pick(['Text the 5th person in your DMs “pizza”.', 'Send the last photo in your camera roll.', 'Do your best impression in VC.', 'Change your nickname to “Pizza Lord” for an hour.']) },
  { name: 'compliment', category: 'qfun', description: 'Get a compliment', run: ({ message }) => `💙 ${message.member?.displayName || message.author.username}, ` + pick(['you’re a whole vibe.', 'your energy is contagious.', 'you make this server better.', 'you’re sharper than you give yourself credit for.']) },
  { name: 'roast', category: 'qfun', description: 'A playful roast', run: ({ message }) => `🔥 ${message.member?.displayName || message.author.username}, ` + pick(['you bring everyone so much joy… when you leave.', 'you’re proof autocorrect can’t fix everything.', 'you have something on your chin… no, the third one.', 'you’re not stupid; you just have bad luck thinking.']) },
  { name: 'pickup', aliases: ['rizz'], category: 'qfun', description: 'A cheesy pickup line', run: () => '😏 ' + pick(['Are you a parking ticket? Because you’ve got FINE written all over you.', 'Do you have a map? I keep getting lost in your eyes.', 'Are you Wi-Fi? Because I’m feeling a connection.', 'If you were a vegetable, you’d be a cute-cumber.']) },
  { name: 'excuse', category: 'qfun', description: 'Generate an excuse', run: () => '🙈 ' + pick(['My code compiled and I fainted from shock.', 'The dog logged into my account and did that.', 'Mercury is in retrograde.', 'I was busy touching grass.']) },
  { name: 'magic', aliases: ['prediction'], category: 'qfun', description: 'A random prediction', run: () => '🔮 ' + pick(['Big money is coming your way.', 'Someone is thinking about you.', 'A surprise DM arrives soon.', 'Your next `?wheel` spin hits big.']) },
  { name: 'howmuch', category: 'qfun', description: '?howmuch <thing> — how much are you?', run: ({ args, message }) => `📈 ${message.member?.displayName || message.author.username} is **${rint(0, 100)}%** ${need(args, '?howmuch <thing>')}.` },

  // ---- GENERATORS (qgen) ----
  { name: 'password', aliases: ['pw', 'genpass'], category: 'qgen', description: '?password [len] — strong password', run: ({ argv }) => { const n = Math.min(64, Math.max(6, nums(argv)[0] || 16)); const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*'; let p = ''; for (let i = 0; i < n; i++) p += c[Math.floor(Math.random() * c.length)]; return `🔐 \`${p}\``; } },
  { name: 'uuid', aliases: ['guid'], category: 'qgen', description: 'Generate a UUID v4', run: () => '🆔 `' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => { const r = Math.random() * 16 | 0; return (ch === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }) + '`' },
  { name: 'color', aliases: ['hex', 'randomcolor'], category: 'qgen', description: 'A random hex color', run: () => { const h = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'); return `🎨 \`${h}\``; } },
  { name: 'palette', category: 'qgen', description: 'A 5-color palette', run: () => '🎨 ' + Array.from({ length: 5 }, () => '`#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0') + '`').join(' ') },
  { name: 'lorem', aliases: ['ipsum'], category: 'qgen', description: '?lorem [words]', run: ({ argv }) => { const n = Math.min(120, Math.max(5, nums(argv)[0] || 30)); const w = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore'.split(' '); return Array.from({ length: n }, () => pick(w)).join(' ') + '.'; } },
  { name: 'b64enc', aliases: ['base64'], category: 'qgen', description: 'Encode text → Base64', run: ({ args }) => Buffer.from(need(args, '?b64enc <text>')).toString('base64') },
  { name: 'b64dec', aliases: ['unbase64'], category: 'qgen', description: 'Decode Base64 → text', run: ({ args }) => { try { return Buffer.from(need(args, '?b64dec <base64>'), 'base64').toString('utf8'); } catch { throw new Error('Invalid Base64.'); } } },
  { name: 'md5', category: 'qgen', description: 'MD5 hash of text', run: ({ args }) => '`' + createHash('md5').update(need(args, '?md5 <text>')).digest('hex') + '`' },
  { name: 'sha256', category: 'qgen', description: 'SHA-256 hash of text', run: ({ args }) => '`' + createHash('sha256').update(need(args, '?sha256 <text>')).digest('hex') + '`' },
  { name: 'teamname', category: 'qgen', description: 'Generate a team name', run: () => '🏆 ' + pick(['The', 'Team', 'Squad']) + ' ' + pick(['Rogue', 'Neon', 'Iron', 'Shadow', 'Turbo', 'Cosmic']) + ' ' + pick(['Wolves', 'Vipers', 'Titans', 'Phantoms', 'Reapers', 'Sharks']) },
  { name: 'bandname', category: 'qgen', description: 'Generate a band name', run: () => '🎸 ' + pick(['The']) + ' ' + pick(['Electric', 'Midnight', 'Screaming', 'Velvet', 'Broken']) + ' ' + pick(['Foxes', 'Astronauts', 'Kings', 'Ghosts', 'Rebels']) },
  { name: 'startup', category: 'qgen', description: 'A startup idea', run: () => '🚀 It’s like ' + pick(['Uber', 'Airbnb', 'Netflix', 'Tinder', 'Spotify']) + ' but for ' + pick(['pizza', 'dogs', 'plants', 'homework', 'grandmas', 'ghosts']) + '.' },
  { name: 'wifiname', category: 'qgen', description: 'A funny Wi-Fi name', run: () => '📶 ' + pick(['Pretty Fly for a Wi-Fi', 'It Hurts When IP', 'Drop It Like a Hotspot', 'The LAN Before Time', 'Bill Wi the Science Fi']) },
  { name: 'catfact', category: 'qgen', description: 'A cat fact 🐱', run: () => '🐱 ' + pick(['Cats sleep 12–16 hours a day.', 'A group of cats is called a clowder.', 'Cats can rotate their ears 180°.', 'A cat’s purr vibrates at a healing frequency.']) },
  { name: 'dogfact', category: 'qgen', description: 'A dog fact 🐶', run: () => '🐶 ' + pick(['A dog’s nose print is unique, like a fingerprint.', 'Dogs can smell your feelings.', 'Puppies are born deaf.', 'Dogs dream just like humans.']) },
  { name: 'emoji', aliases: ['randomemoji'], category: 'qgen', description: 'A random emoji', run: () => Array.from({ length: 3 }, () => pick(['😀', '🐶', '🍕', '🚀', '🔥', '🌈', '👾', '🎲', '🍀', '⚡', '🦊', '🌮', '🎸', '💎'])).join('') },
  { name: 'numfact', category: 'qgen', description: '?numfact <n> — a fact about a number', run: ({ argv }) => { const [n] = nums(argv); if (n == null) throw new Error('Usage: `?numfact 42`'); const facts = [`${n} in binary is ${n.toString(2)}.`, `${n} in hex is ${n.toString(16)}.`, `${n} is ${n % 2 ? 'odd' : 'even'}.`, `${n} squared is ${n * n}.`]; return `🔢 ${pick(facts)}`; } },

  // ---- mini GAMES (qgame) ----
  { name: 'scramble', category: 'qgame', description: 'Scramble a word', run: ({ args }) => [...need(args, '?scramble <word>')].sort(() => Math.random() - 0.5).join('') },
  { name: 'guess', category: 'qgame', description: '?guess <1-10> — beat my number', run: ({ argv }) => { const [g] = nums(argv); if (g == null || g < 1 || g > 10) throw new Error('Guess a number 1–10: `?guess 7`'); const n = rint(1, 10); return g === n ? `🎉 **${n}** — you nailed it!` : `❌ I had **${n}**. So close!`; } },
  { name: 'spell', category: 'qgame', description: 'Spell a word out l-i-k-e t-h-i-s', run: ({ args }) => need(args, '?spell <word>').split(/\s+/).map((w) => [...w].join('-')).join('  ') },
  { name: 'anagram', category: 'qgame', description: '?anagram <a> <b> — are they anagrams?', run: ({ argv }) => { if (argv.length < 2) throw new Error('Usage: `?anagram listen silent`'); const norm = (s) => [...s.toLowerCase().replace(/[^a-z]/g, '')].sort().join(''); return norm(argv[0]) === norm(argv[1]) ? '✅ Yes, they’re anagrams!' : '❌ Nope, not anagrams.'; } },
  { name: 'trivia', category: 'qgame', description: 'A trivia question (answer hidden)', run: () => { const q = pick([['What planet is the Red Planet?', 'Mars'], ['How many continents are there?', '7'], ['What’s the largest ocean?', 'Pacific'], ['What year did WW2 end?', '1945']]); return `❓ ${q[0]}\n||Answer: ${q[1]}||`; } },
  { name: 'countdown', aliases: ['cd'], category: 'qgame', description: '?countdown <n> — a number countdown', run: ({ argv }) => { const n = Math.min(15, Math.max(1, nums(argv)[0] || 5)); return Array.from({ length: n }, (_, i) => n - i).join(' … ') + ' … 🎉 GO!'; } },
  { name: 'slots', category: 'qgame', description: 'Spin the slot machine 🎰', run: () => { const s = ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣']; const r = [pick(s), pick(s), pick(s)]; const win = r[0] === r[1] && r[1] === r[2]; return `🎰 [ ${r.join(' | ')} ] ${win ? '— JACKPOT! 🎉' : '— try again!'}`; } },
  { name: 'dice2', aliases: ['yahtzee'], category: 'qgame', description: 'Roll five dice', run: () => { const r = Array.from({ length: 5 }, () => rint(1, 6)); return `🎲 [${r.join(', ')}] = **${r.reduce((a, b) => a + b, 0)}**`; } },

  // =================== EXPANSION → 1K (all functional) ===================
  // ---- 📐 UNIT CONVERSIONS (qconv) ----
  CONV('in2cm', 'in', 'cm', (n) => n * 2.54, '📏'), CONV('cm2in', 'cm', 'in', (n) => n / 2.54, '📏'),
  CONV('m2ft', 'm', 'ft', (n) => n * 3.28084, '📏'), CONV('yd2m', 'yd', 'm', (n) => n * 0.9144, '📏'),
  CONV('m2yd', 'm', 'yd', (n) => n / 0.9144, '📏'), CONV('mi2ft', 'mi', 'ft', (n) => n * 5280, '📏'),
  CONV('ft2in', 'ft', 'in', (n) => n * 12, '📏'), CONV('in2ft', 'in', 'ft', (n) => n / 12, '📏'),
  CONV('mm2cm', 'mm', 'cm', (n) => n / 10, '📏'), CONV('cm2m', 'cm', 'm', (n) => n / 100, '📏'),
  CONV('km2m', 'km', 'm', (n) => n * 1000, '📏'), CONV('m2km', 'm', 'km', (n) => n / 1000, '📏'),
  CONV('nmi2km', 'nmi', 'km', (n) => n * 1.852, '⚓'),
  CONV('oz2g', 'oz', 'g', (n) => n * 28.3495, '⚖️'), CONV('g2oz', 'g', 'oz', (n) => n / 28.3495, '⚖️'),
  CONV('lb2oz', 'lb', 'oz', (n) => n * 16, '⚖️'), CONV('oz2lb', 'oz', 'lb', (n) => n / 16, '⚖️'),
  CONV('ton2kg', 'ton', 'kg', (n) => n * 1000, '⚖️'), CONV('kg2ton', 'kg', 'ton', (n) => n / 1000, '⚖️'),
  CONV('st2kg', 'st', 'kg', (n) => n * 6.35029, '⚖️'), CONV('g2kg', 'g', 'kg', (n) => n / 1000, '⚖️'),
  CONV('mg2g', 'mg', 'g', (n) => n / 1000, '⚖️'),
  CONV('l2gal', 'L', 'gal', (n) => n * 0.264172, '🥤'), CONV('gal2l', 'gal', 'L', (n) => n / 0.264172, '🥤'),
  CONV('ml2l', 'mL', 'L', (n) => n / 1000, '🥤'), CONV('cup2ml', 'cup', 'mL', (n) => n * 236.588, '🥤'),
  CONV('tbsp2ml', 'tbsp', 'mL', (n) => n * 14.7868, '🥄'), CONV('tsp2ml', 'tsp', 'mL', (n) => n * 4.92892, '🥄'),
  CONV('pt2ml', 'pt', 'mL', (n) => n * 473.176, '🥤'), CONV('qt2l', 'qt', 'L', (n) => n * 0.946353, '🥤'),
  CONV('floz2ml', 'fl-oz', 'mL', (n) => n * 29.5735, '🥤'),
  CONV('c2k', '°C', 'K', (n) => n + 273.15, '🌡️'), CONV('k2c', 'K', '°C', (n) => n - 273.15, '🌡️'),
  CONV('f2k', '°F', 'K', (n) => (n - 32) * 5 / 9 + 273.15, '🌡️'), CONV('k2f', 'K', '°F', (n) => (n - 273.15) * 9 / 5 + 32, '🌡️'),
  CONV('mph2kmh', 'mph', 'km/h', (n) => n * 1.60934, '🚗'), CONV('kmh2mph', 'km/h', 'mph', (n) => n / 1.60934, '🚗'),
  CONV('kn2kmh', 'kn', 'km/h', (n) => n * 1.852, '✈️'), CONV('ms2kmh', 'm/s', 'km/h', (n) => n * 3.6, '🏃'),
  CONV('kmh2ms', 'km/h', 'm/s', (n) => n / 3.6, '🏃'), CONV('mph2ms', 'mph', 'm/s', (n) => n * 0.44704, '🏃'),
  CONV('sqft2sqm', 'sq-ft', 'sq-m', (n) => n * 0.092903, '🟦'), CONV('sqm2sqft', 'sq-m', 'sq-ft', (n) => n / 0.092903, '🟦'),
  CONV('acre2sqm', 'acre', 'sq-m', (n) => n * 4046.86, '🌾'), CONV('ha2sqm', 'ha', 'sq-m', (n) => n * 10000, '🌾'),
  CONV('kb2mb', 'KB', 'MB', (n) => n / 1024, '💾'), CONV('mb2kb', 'MB', 'KB', (n) => n * 1024, '💾'),
  CONV('mb2gb', 'MB', 'GB', (n) => n / 1024, '💾'), CONV('gb2mb', 'GB', 'MB', (n) => n * 1024, '💾'),
  CONV('gb2tb', 'GB', 'TB', (n) => n / 1024, '💾'), CONV('tb2gb', 'TB', 'GB', (n) => n * 1024, '💾'),
  CONV('byte2bit', 'B', 'bit', (n) => n * 8, '💾'), CONV('bit2byte', 'bit', 'B', (n) => n / 8, '💾'),
  CONV('cal2j', 'cal', 'J', (n) => n * 4.184, '⚡'), CONV('j2cal', 'J', 'cal', (n) => n / 4.184, '⚡'),
  CONV('psi2kpa', 'psi', 'kPa', (n) => n * 6.89476, '🎈'), CONV('kpa2psi', 'kPa', 'psi', (n) => n / 6.89476, '🎈'),
  CONV('bar2psi', 'bar', 'psi', (n) => n * 14.5038, '🎈'),
  CONV('deg2rad', 'deg', 'rad', (n) => n * Math.PI / 180, '📐'), CONV('rad2deg', 'rad', 'deg', (n) => n * 180 / Math.PI, '📐'),
  CONV('hr2min', 'hr', 'min', (n) => n * 60, '⏱️'), CONV('day2hr', 'day', 'hr', (n) => n * 24, '⏱️'),
  CONV('wk2day', 'wk', 'day', (n) => n * 7, '📅'), CONV('yr2day', 'yr', 'day', (n) => n * 365, '📅'),
  CONV('min2sec', 'min', 'sec', (n) => n * 60, '⏱️'),

  // ---- 🧮 MATH / GEOMETRY / STATS (qmath3) ----
  { name: 'sine', category: 'qmath3', description: 'sin of an angle (degrees)', run: ({ argv }) => { const [d] = nums(argv); if (d == null) throw new Error('Usage: `?sine 30`'); return `📐 sin(${d}°) = **${round(Math.sin(d * Math.PI / 180), 5)}**`; } },
  { name: 'cosine', category: 'qmath3', description: 'cos of an angle (degrees)', run: ({ argv }) => { const [d] = nums(argv); if (d == null) throw new Error('Usage: `?cosine 60`'); return `📐 cos(${d}°) = **${round(Math.cos(d * Math.PI / 180), 5)}**`; } },
  { name: 'tangent', category: 'qmath3', description: 'tan of an angle (degrees)', run: ({ argv }) => { const [d] = nums(argv); if (d == null) throw new Error('Usage: `?tangent 45`'); return `📐 tan(${d}°) = **${round(Math.tan(d * Math.PI / 180), 5)}**`; } },
  { name: 'log10', category: 'qmath3', description: 'Base-10 logarithm', run: ({ argv }) => { const [n] = nums(argv); if (!(n > 0)) throw new Error('Usage: `?log10 1000`'); return `log₁₀(${n}) = **${round(Math.log10(n), 5)}**`; } },
  { name: 'ln', category: 'qmath3', description: 'Natural logarithm', run: ({ argv }) => { const [n] = nums(argv); if (!(n > 0)) throw new Error('Usage: `?ln 2.718`'); return `ln(${n}) = **${round(Math.log(n), 5)}**`; } },
  { name: 'log2', category: 'qmath3', description: 'Base-2 logarithm', run: ({ argv }) => { const [n] = nums(argv); if (!(n > 0)) throw new Error('Usage: `?log2 256`'); return `log₂(${n}) = **${round(Math.log2(n), 5)}**`; } },
  { name: 'cbrt', category: 'qmath3', description: 'Cube root', run: ({ argv }) => { const [n] = nums(argv); if (n == null) throw new Error('Usage: `?cbrt 27`'); return `∛${n} = **${round(Math.cbrt(n), 5)}**`; } },
  { name: 'divisors', category: 'qmath3', description: 'All divisors of a number', run: ({ argv }) => { const [n] = nums(argv); if (!n || n < 1 || n > 1e6) throw new Error('Usage: `?divisors 24`'); const d = []; for (let i = 1; i <= n; i++) if (n % i === 0) d.push(i); return `➗ Divisors of ${n}: ${d.join(', ')}`; } },
  { name: 'primefactors', aliases: ['factorize'], category: 'qmath3', description: 'Prime factorization', run: ({ argv }) => { let [n] = nums(argv); if (!n || n < 2 || n > 1e9) throw new Error('Usage: `?primefactors 84`'); const f = []; for (let i = 2; i * i <= n; i++) while (n % i === 0) { f.push(i); n /= i; } if (n > 1) f.push(n); return `🔢 = ${f.join(' × ')}`; } },
  { name: 'digitalroot', category: 'qmath3', description: 'Repeated digit sum', run: ({ argv }) => { let [n] = nums(argv); if (n == null) throw new Error('Usage: `?digitalroot 9875`'); n = Math.abs(n); while (n > 9) n = String(n).split('').reduce((a, c) => a + +c, 0); return `🌱 Digital root = **${n}**`; } },
  { name: 'sumdigits', category: 'qmath3', description: 'Sum of the digits', run: ({ argv }) => { const [n] = nums(argv); if (n == null) throw new Error('Usage: `?sumdigits 12345`'); return `➕ Digit sum = **${String(Math.abs(n)).split('').reduce((a, c) => a + +c, 0)}**`; } },
  { name: 'collatz', category: 'qmath3', description: 'Collatz steps to reach 1', run: ({ argv }) => { let [n] = nums(argv); if (!n || n < 1 || n > 1e7) throw new Error('Usage: `?collatz 27`'); let s = 0; while (n !== 1 && s < 2000) { n = n % 2 ? 3 * n + 1 : n / 2; s++; } return `🔁 ${s} steps to reach 1`; } },
  { name: 'circlearea', category: 'qmath3', description: 'Area of a circle (radius)', run: ({ argv }) => { const [r] = nums(argv); if (r == null) throw new Error('Usage: `?circlearea 5`'); return `⭕ Area = **${round(Math.PI * r * r, 3)}**`; } },
  { name: 'circumference', aliases: ['circum'], category: 'qmath3', description: 'Circumference of a circle', run: ({ argv }) => { const [r] = nums(argv); if (r == null) throw new Error('Usage: `?circumference 5`'); return `⭕ Circumference = **${round(2 * Math.PI * r, 3)}**`; } },
  { name: 'spherevol', category: 'qmath3', description: 'Volume of a sphere (radius)', run: ({ argv }) => { const [r] = nums(argv); if (r == null) throw new Error('Usage: `?spherevol 3`'); return `🔵 Volume = **${round(4 / 3 * Math.PI * r ** 3, 3)}**`; } },
  { name: 'cubevol', category: 'qmath3', description: 'Volume of a cube (side)', run: ({ argv }) => { const [s] = nums(argv); if (s == null) throw new Error('Usage: `?cubevol 4`'); return `🧊 Volume = **${round(s ** 3, 3)}**`; } },
  { name: 'cylindervol', category: 'qmath3', description: 'Cylinder volume: ?cylindervol <r> <h>', run: ({ argv }) => { const [r, h] = need2(argv, 2, '?cylindervol 3 10'); return `🥫 Volume = **${round(Math.PI * r * r * h, 3)}**`; } },
  { name: 'trianglearea', category: 'qmath3', description: 'Triangle area: ?trianglearea <base> <height>', run: ({ argv }) => { const [b, h] = need2(argv, 2, '?trianglearea 6 8'); return `📐 Area = **${round(0.5 * b * h, 3)}**`; } },
  { name: 'hypotenuse', aliases: ['hypot', 'pythag'], category: 'qmath3', description: 'Hypotenuse: ?hypotenuse <a> <b>', run: ({ argv }) => { const [a, b] = need2(argv, 2, '?hypotenuse 3 4'); return `📐 Hypotenuse = **${round(Math.hypot(a, b), 4)}**`; } },
  { name: 'distance', category: 'qmath3', description: 'Distance: ?distance <x1> <y1> <x2> <y2>', run: ({ argv }) => { const [a, b, c, d] = need2(argv, 4, '?distance 0 0 3 4'); return `📏 Distance = **${round(Math.hypot(c - a, d - b), 4)}**`; } },
  { name: 'median', category: 'qmath3', description: 'Median of a list', run: ({ argv }) => { const n = nums(argv).sort((a, b) => a - b); if (!n.length) throw new Error('Usage: `?median 3 1 4 1 5`'); const m = n.length % 2 ? n[(n.length - 1) / 2] : (n[n.length / 2 - 1] + n[n.length / 2]) / 2; return `📊 Median = **${m}**`; } },
  { name: 'mode', category: 'qmath3', description: 'Most frequent number', run: ({ argv }) => { const n = nums(argv); if (!n.length) throw new Error('Usage: `?mode 1 2 2 3`'); const f = {}; let best = n[0]; for (const x of n) { f[x] = (f[x] || 0) + 1; if (f[x] > f[best]) best = x; } return `📊 Mode = **${best}**`; } },
  { name: 'stddev', aliases: ['stdev'], category: 'qmath3', description: 'Standard deviation', run: ({ argv }) => { const n = nums(argv); if (n.length < 2) throw new Error('Usage: `?stddev 2 4 4 4 5 5 7 9`'); const m = n.reduce((a, b) => a + b, 0) / n.length; const v = n.reduce((a, b) => a + (b - m) ** 2, 0) / n.length; return `📊 σ = **${round(Math.sqrt(v), 4)}**`; } },
  { name: 'variance', category: 'qmath3', description: 'Variance of a list', run: ({ argv }) => { const n = nums(argv); if (n.length < 2) throw new Error('Usage: `?variance 2 4 6`'); const m = n.reduce((a, b) => a + b, 0) / n.length; return `📊 Variance = **${round(n.reduce((a, b) => a + (b - m) ** 2, 0) / n.length, 4)}**`; } },
  { name: 'range', category: 'qmath3', description: 'Max − min of a list', run: ({ argv }) => { const n = nums(argv); if (!n.length) throw new Error('Usage: `?range 3 9 1 7`'); return `📊 Range = **${Math.max(...n) - Math.min(...n)}**`; } },
  { name: 'product', category: 'qmath3', description: 'Multiply a list of numbers', run: ({ argv }) => { const n = nums(argv); if (!n.length) throw new Error('Usage: `?product 2 3 4`'); return `✖️ Product = **${n.reduce((a, b) => a * b, 1)}**`; } },
  { name: 'compound', category: 'qmath3', description: 'Compound interest: ?compound <principal> <rate%> <years>', run: ({ argv }) => { const [p, r, t] = need2(argv, 3, '?compound 1000 5 10'); return `💹 = **${round(p * (1 + r / 100) ** t, 2)}**`; } },
  { name: 'discount', category: 'qmath3', description: 'Price after discount: ?discount <price> <pct>', run: ({ argv }) => { const [p, d] = need2(argv, 2, '?discount 80 25'); return `🏷️ ${p} − ${d}% = **${round(p * (1 - d / 100), 2)}**`; } },
  { name: 'markup', category: 'qmath3', description: 'Price after markup: ?markup <cost> <pct>', run: ({ argv }) => { const [c, m] = need2(argv, 2, '?markup 40 50'); return `📈 = **${round(c * (1 + m / 100), 2)}**`; } },
  { name: 'hourly', category: 'qmath3', description: 'Annual salary → hourly (2080h)', run: ({ argv }) => { const [a] = nums(argv); if (a == null) throw new Error('Usage: `?hourly 60000`'); return `💵 ≈ **${round(a / 2080, 2)}/hr**`; } },

  // ---- 🔐 CIPHERS / ENCODERS (qcipher) ----
  { name: 'caesar', category: 'qcipher', description: 'Caesar cipher: ?caesar <shift> <text>', run: ({ argv, args }) => { const shift = Number(argv[0]); if (Number.isNaN(shift)) throw new Error('Usage: `?caesar 3 hello`'); return caesar(args.replace(/^\s*-?\d+\s*/, ''), shift); } },
  { name: 'uncaesar', aliases: ['decaesar'], category: 'qcipher', description: 'Decode Caesar: ?uncaesar <shift> <text>', run: ({ argv, args }) => { const shift = Number(argv[0]); if (Number.isNaN(shift)) throw new Error('Usage: `?uncaesar 3 khoor`'); return caesar(args.replace(/^\s*-?\d+\s*/, ''), -shift); } },
  { name: 'atbash', category: 'qcipher', description: 'Atbash cipher (mirror alphabet)', run: ({ args }) => atbash(need(args, '?atbash hello')) },
  { name: 'rot47', category: 'qcipher', description: 'ROT47 cipher', run: ({ args }) => [...need(args, '?rot47 hello')].map((c) => { const x = c.charCodeAt(0); return x >= 33 && x <= 126 ? String.fromCharCode(33 + (x - 33 + 47) % 94) : c; }).join('') },
  { name: 'urlenc', aliases: ['urlencode'], category: 'qcipher', description: 'URL-encode text', run: ({ args }) => encodeURIComponent(need(args, '?urlenc hi there')) },
  { name: 'urldec', aliases: ['urldecode'], category: 'qcipher', description: 'URL-decode text', run: ({ args }) => { try { return decodeURIComponent(need(args, '?urldec hi%20there')); } catch { throw new Error('Invalid URL encoding.'); } } },
  { name: 'hexenc', category: 'qcipher', description: 'Text → hex', run: ({ args }) => Buffer.from(need(args, '?hexenc hello')).toString('hex') },
  { name: 'hexdec', category: 'qcipher', description: 'Hex → text', run: ({ args }) => { try { return Buffer.from(need(args, '?hexdec 68656c6c6f').replace(/\s/g, ''), 'hex').toString('utf8'); } catch { throw new Error('Invalid hex.'); } } },
  { name: 'nato', aliases: ['phonetic'], category: 'qcipher', description: 'Spell with NATO alphabet', run: ({ args }) => [...need(args, '?nato abc').toLowerCase()].map((c) => NATO[c] || (c === ' ' ? '/' : c)).join(' ') },
  { name: 'a1z26', category: 'qcipher', description: 'Letters → numbers (A=1…Z=26)', run: ({ args }) => need(args, '?a1z26 hi').toLowerCase().replace(/[a-z]/g, (c) => (c.charCodeAt(0) - 96) + ' ').trim() },

  // ---- ✂️ STRING TOOLS (qstr) ----
  { name: 'len', aliases: ['length'], category: 'qstr', description: 'Character length', run: ({ args }) => `📏 **${[...need(args, '?len text')].length}** characters` },
  { name: 'words', aliases: ['wordcount'], category: 'qstr', description: 'Word count', run: ({ args }) => `🔤 **${need(args, '?words some text').split(/\s+/).length}** words` },
  { name: 'repeat', category: 'qstr', description: '?repeat <n> <text>', run: ({ argv, args }) => { const n = Math.min(50, Math.max(1, Number(argv[0]) || 0)); const t = args.replace(/^\s*\d+\s*/, ''); if (!t) throw new Error('Usage: `?repeat 3 hi`'); return (t + ' ').repeat(n).trim(); } },
  { name: 'firstword', category: 'qstr', description: 'The first word', run: ({ args }) => need(args, '?firstword hello world').split(/\s+/)[0] },
  { name: 'lastword', category: 'qstr', description: 'The last word', run: ({ args }) => { const w = need(args, '?lastword hello world').split(/\s+/); return w[w.length - 1]; } },
  { name: 'capitalize', aliases: ['cap'], category: 'qstr', description: 'Capitalize first letter', run: ({ args }) => { const s = need(args, '?capitalize hello'); return s[0].toUpperCase() + s.slice(1); } },
  { name: 'swapcase', category: 'qstr', description: 'Swap upper/lower case', run: ({ args }) => need(args, '?swapcase Hello').replace(/[a-z]/gi, (c) => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()) },
  { name: 'removespaces', aliases: ['nospaces'], category: 'qstr', description: 'Remove all spaces', run: ({ args }) => need(args, '?removespaces a b c').replace(/\s+/g, '') },
  { name: 'removepunct', category: 'qstr', description: 'Strip punctuation', run: ({ args }) => need(args, '?removepunct hi, there!').replace(/[^\w\s]/g, '') },
  { name: 'onlynums', aliases: ['digitsonly'], category: 'qstr', description: 'Keep only digits', run: ({ args }) => (need(args, '?onlynums a1b2c3').replace(/\D/g, '') || '(no digits)') },
  { name: 'onlyletters', category: 'qstr', description: 'Keep only letters', run: ({ args }) => (need(args, '?onlyletters a1b2c3').replace(/[^a-z]/gi, '') || '(no letters)') },
  { name: 'extracturls', aliases: ['urls'], category: 'qstr', description: 'Pull URLs from text', run: ({ args }) => (need(args, '?extracturls ...').match(/https?:\/\/\S+/g) || ['(none found)']).join('\n') },
  { name: 'extractnums', category: 'qstr', description: 'Pull numbers from text', run: ({ args }) => (need(args, '?extractnums a 5 b 12').match(/-?\d+\.?\d*/g) || ['(none)']).join(', ') },
  { name: 'sortwords', category: 'qstr', description: 'Sort words alphabetically', run: ({ args }) => need(args, '?sortwords banana apple cherry').split(/\s+/).sort().join(' ') },
  { name: 'uniquewords', aliases: ['dedupe'], category: 'qstr', description: 'Remove duplicate words', run: ({ args }) => [...new Set(need(args, '?uniquewords a a b c c').split(/\s+/))].join(' ') },
  { name: 'shuffleword', aliases: ['shufflewords'], category: 'qstr', description: 'Shuffle the word order', run: ({ args }) => need(args, '?shuffleword one two three').split(/\s+/).sort(() => Math.random() - 0.5).join(' ') },
  { name: 'initials', category: 'qstr', description: 'Initials of each word', run: ({ args }) => need(args, '?initials john fitzgerald kennedy').split(/\s+/).map((w) => w[0]?.toUpperCase()).join('.') + '.' },
  { name: 'wordfreq', category: 'qstr', description: 'Most common word', run: ({ args }) => { const w = need(args, '?wordfreq the cat the dog the').toLowerCase().split(/\s+/); const f = {}; let best = w[0]; for (const x of w) { f[x] = (f[x] || 0) + 1; if (f[x] > f[best]) best = x; } return `🔁 Most common: **${best}** (${f[best]}×)`; } },
  { name: 'truncate', aliases: ['trunc'], category: 'qstr', description: '?truncate <n> <text>', run: ({ argv, args }) => { const n = Math.max(1, Number(argv[0]) || 10); const t = args.replace(/^\s*\d+\s*/, ''); if (!t) throw new Error('Usage: `?truncate 10 long text here`'); return t.length > n ? t.slice(0, n) + '…' : t; } },

  // ---- ⏰ TIME (qtime) ----
  { name: 'unix', aliases: ['epoch'], category: 'qtime', description: 'Current Unix timestamp', run: () => `🕒 **${Math.floor(Date.now() / 1000)}**` },
  { name: 'unixms', category: 'qtime', description: 'Current Unix ms timestamp', run: () => `🕒 **${Date.now()}**` },
  { name: 'nowiso', aliases: ['iso'], category: 'qtime', description: 'Current time (ISO 8601)', run: () => `🕒 ${new Date().toISOString()}` },
  { name: 'fromunix', aliases: ['timestamp'], category: 'qtime', description: 'Unix timestamp → date', run: ({ argv }) => { const [n] = nums(argv); if (n == null) throw new Error('Usage: `?fromunix 1700000000`'); return `📅 ${new Date((n < 1e12 ? n * 1000 : n)).toUTCString()}`; } },
  { name: 'daysuntil', aliases: ['countdown2'], category: 'qtime', description: 'Days until a date (YYYY-MM-DD)', run: ({ args }) => { const d = new Date(need(args, '?daysuntil 2027-01-01')); if (isNaN(d)) throw new Error('Use YYYY-MM-DD'); return `⏳ **${Math.ceil((d - Date.now()) / 86400000)}** days`; } },
  { name: 'agecalc', aliases: ['ageof'], category: 'qtime', description: 'Age from birthdate (YYYY-MM-DD)', run: ({ args }) => { const d = new Date(need(args, '?agecalc 2000-05-15')); if (isNaN(d)) throw new Error('Use YYYY-MM-DD'); return `🎂 **${Math.floor((Date.now() - d) / 31557600000)}** years old`; } },
  { name: 'dayofweek', aliases: ['weekday'], category: 'qtime', description: 'Day of the week for a date', run: ({ args }) => { const d = new Date(need(args, '?dayofweek 2026-12-25')); if (isNaN(d)) throw new Error('Use YYYY-MM-DD'); return `📅 ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()]}`; } },
  { name: 'isleap', category: 'qtime', description: 'Is a year a leap year?', run: ({ argv }) => { const [y] = nums(argv); if (y == null) throw new Error('Usage: `?isleap 2024`'); const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; return `${leap ? '✅' : '❌'} ${y} is ${leap ? '' : 'not '}a leap year.`; } },
  { name: 'daysin', category: 'qtime', description: 'Days in a month: ?daysin <month> <year>', run: ({ argv }) => { const [m, y] = need2(argv, 2, '?daysin 2 2024'); return `📅 **${new Date(y, m, 0).getDate()}** days`; } },
  { name: 'untilnewyear', aliases: ['newyear'], category: 'qtime', description: 'Days until New Year', run: () => { const now = new Date(); const ny = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1)); return `🎆 **${Math.ceil((ny - now) / 86400000)}** days until New Year!`; } },

  // ---- 🎲 MORE GENERATORS (qgen2) ----
  { name: 'pin', category: 'qgen2', description: '?pin [len] — random PIN', run: ({ argv }) => { const n = Math.min(12, Math.max(3, nums(argv)[0] || 4)); return '🔢 `' + Array.from({ length: n }, () => rint(0, 9)).join('') + '`'; } },
  { name: 'otp', aliases: ['2fa'], category: 'qgen2', description: 'A random 6-digit code', run: () => '🔐 `' + String(rint(0, 999999)).padStart(6, '0') + '`' },
  { name: 'rgbcolor', aliases: ['rgb'], category: 'qgen2', description: 'A random RGB color', run: () => `🎨 rgb(${rint(0, 255)}, ${rint(0, 255)}, ${rint(0, 255)})` },
  { name: 'passphrase', category: 'qgen2', description: 'A memorable word passphrase', run: () => { const w = 'apple river tiger cloud stone maple otter comet ember flint pixel raven'.split(' '); return '🔑 `' + Array.from({ length: 4 }, () => pick(w)).join('-') + '-' + rint(10, 99) + '`'; } },
  { name: 'gamertag', category: 'qgen2', description: 'A random gamertag', run: () => pick(['xX', 'The', 'Pro', 'Dark', 'Toxic']) + pick(['Sniper', 'Ninja', 'Reaper', 'Ghost', 'Wolf', 'Blaze']) + rint(1, 999) },
  { name: 'petname', category: 'qgen2', description: 'A random pet name', run: () => '🐾 ' + pick(['Biscuit', 'Mochi', 'Pepper', 'Waffles', 'Luna', 'Bandit', 'Noodle', 'Peanut', 'Ziggy', 'Marble']) },
  { name: 'superhero', category: 'qgen2', description: 'A superhero name', run: () => '🦸 ' + pick(['Captain', 'The', 'Mega', 'Ultra']) + ' ' + pick(['Thunder', 'Shadow', 'Blaze', 'Frost', 'Quantum']) + pick([' Bolt', ' Fist', ' Storm', ' Guard']) },
  { name: 'villain', category: 'qgen2', description: 'A supervillain name', run: () => '🦹 ' + pick(['Doctor', 'Lord', 'The', 'Baron']) + ' ' + pick(['Venom', 'Chaos', 'Grim', 'Malice', 'Dread']) },
  { name: 'planet', category: 'qgen2', description: 'A made-up planet name', run: () => '🪐 ' + pick(['Xy', 'Kro', 'Zeph', 'Vor', 'Neb', 'Tal']) + pick(['thar', 'nos', 'ion', 'ara', 'ux', 'eth']) + '-' + rint(1, 9) },
  { name: 'coord', aliases: ['latlong'], category: 'qgen2', description: 'A random lat/long coordinate', run: () => `🌍 ${round(rint(-90000, 90000) / 1000, 3)}, ${round(rint(-180000, 180000) / 1000, 3)}` },
  { name: 'card', aliases: ['drawcard'], category: 'qgen2', description: 'Draw a playing card', run: () => `🃏 ${pick(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'])}${pick(['♠️', '♥️', '♦️', '♣️'])}` },
  { name: 'randword', aliases: ['word'], category: 'qgen2', description: 'A random English word', run: () => pick(['serendipity', 'ephemeral', 'labyrinth', 'quixotic', 'luminous', 'cascade', 'ember', 'zephyr', 'obsidian', 'nebula', 'velvet', 'thunder']) },
  { name: 'firstname', category: 'qgen2', description: 'A random first name', run: () => pick(['Alex', 'Jordan', 'Riley', 'Sam', 'Casey', 'Morgan', 'Taylor', 'Jamie', 'Noah', 'Ava', 'Liam', 'Mia']) },
  { name: 'lastname', category: 'qgen2', description: 'A random last name', run: () => pick(['Smith', 'Reyes', 'Kim', 'Novak', 'Hunter', 'Blake', 'Cruz', 'Ford', 'Vega', 'Stone', 'Wolfe', 'Frost']) },
  { name: 'animal', category: 'qgen2', description: 'A random animal', run: () => pick(['🦊 fox', '🐼 panda', '🦁 lion', '🐙 octopus', '🦉 owl', '🐢 turtle', '🦈 shark', '🐨 koala', '🦥 sloth', '🐧 penguin']) },
  { name: 'rollstats', aliases: ['dndstats'], category: 'qgen2', description: 'Roll D&D-style ability scores', run: () => '🎲 STR ' + rint(3, 18) + ' · DEX ' + rint(3, 18) + ' · CON ' + rint(3, 18) + ' · INT ' + rint(3, 18) + ' · WIS ' + rint(3, 18) + ' · CHA ' + rint(3, 18) },

  // ---- 🔠 UNICODE STYLES + KAOMOJI (qstyle) ----
  { name: 'strike', aliases: ['strikethrough'], category: 'qstyle', description: 'S̶t̶r̶i̶k̶e̶ through text', run: ({ args }) => strike(need(args, '?strike text')) },
  { name: 'underln', aliases: ['ul'], category: 'qstyle', description: 'U̲n̲d̲e̲r̲l̲i̲n̲e̲ text', run: ({ args }) => underline(need(args, '?underln text')) },
  { name: 'bubble', aliases: ['circled'], category: 'qstyle', description: 'Ⓑⓤⓑⓑⓛⓔ text', run: ({ args }) => [...need(args, '?bubble text')].map((c) => /[a-z]/.test(c) ? String.fromCodePoint(0x24D0 + c.charCodeAt(0) - 97) : /[A-Z]/.test(c) ? String.fromCodePoint(0x24B6 + c.charCodeAt(0) - 65) : c).join('') },
  { name: 'shrug', category: 'qstyle', description: '¯\\_(ツ)_/¯', run: () => '¯\\_(ツ)_/¯' },
  { name: 'tableflip', aliases: ['flip2'], category: 'qstyle', description: 'Flip the table', run: () => '(╯°□°）╯︵ ┻━┻' },
  { name: 'unflip', category: 'qstyle', description: 'Put the table back', run: () => '┬─┬ ノ( ゜-゜ノ)' },
  { name: 'lenny', category: 'qstyle', description: '( ͡° ͜ʖ ͡°)', run: () => '( ͡° ͜ʖ ͡°)' },
  { name: 'disapproval', aliases: ['stare'], category: 'qstyle', description: 'ಠ_ಠ', run: () => 'ಠ_ಠ' },
  { name: 'bear', category: 'qstyle', description: 'ʕ•ᴥ•ʔ', run: () => 'ʕ•ᴥ•ʔ' },
  { name: 'cry', category: 'qstyle', description: '(╥﹏╥)', run: () => '(╥﹏╥)' },

  // =================== BATCH 2 → 1,000 (all functional) ===================
  // ---- 📐 CONVERSIONS 2 ----
  CONV('qt2gal', 'qt', 'gal', (n) => n / 4, '🥤'), CONV('gal2qt', 'gal', 'qt', (n) => n * 4, '🥤'),
  CONV('cup2tbsp', 'cup', 'tbsp', (n) => n * 16, '🥄'), CONV('tbsp2tsp', 'tbsp', 'tsp', (n) => n * 3, '🥄'),
  CONV('cup2floz', 'cup', 'fl-oz', (n) => n * 8, '🥤'), CONV('l2floz', 'L', 'fl-oz', (n) => n * 33.814, '🥤'),
  CONV('sqkm2sqmi', 'sq-km', 'sq-mi', (n) => n * 0.386102, '🗺️'), CONV('sqmi2sqkm', 'sq-mi', 'sq-km', (n) => n * 2.58999, '🗺️'),
  CONV('sqyd2sqm', 'sq-yd', 'sq-m', (n) => n * 0.836127, '🟦'), CONV('sqin2sqcm', 'sq-in', 'sq-cm', (n) => n * 6.4516, '🟦'),
  CONV('tb2pb', 'TB', 'PB', (n) => n / 1024, '💾'), CONV('pb2tb', 'PB', 'TB', (n) => n * 1024, '💾'),
  CONV('kb2gb', 'KB', 'GB', (n) => n / 1048576, '💾'),
  CONV('kwh2j', 'kWh', 'J', (n) => n * 3.6e6, '⚡'), CONV('j2kwh', 'J', 'kWh', (n) => n / 3.6e6, '⚡'),
  CONV('btu2j', 'BTU', 'J', (n) => n * 1055.06, '🔥'), CONV('kwh2btu', 'kWh', 'BTU', (n) => n * 3412.14, '🔥'),
  CONV('hp2kw', 'hp', 'kW', (n) => n * 0.7457, '🐎'), CONV('kw2hp', 'kW', 'hp', (n) => n / 0.7457, '🐎'),
  CONV('w2hp', 'W', 'hp', (n) => n / 745.7, '🐎'),
  CONV('atm2kpa', 'atm', 'kPa', (n) => n * 101.325, '🎈'), CONV('mmhg2kpa', 'mmHg', 'kPa', (n) => n * 0.133322, '🎈'),
  CONV('torr2kpa', 'torr', 'kPa', (n) => n * 0.133322, '🎈'),
  CONV('grad2deg', 'grad', 'deg', (n) => n * 0.9, '📐'), CONV('deg2grad', 'deg', 'grad', (n) => n / 0.9, '📐'),
  CONV('fps2mph', 'ft/s', 'mph', (n) => n * 0.681818, '🏃'), CONV('mph2fps', 'mph', 'ft/s', (n) => n * 1.46667, '🏃'),
  CONV('mach2mph', 'Mach', 'mph', (n) => n * 767.269, '✈️'),
  CONV('hz2khz', 'Hz', 'kHz', (n) => n / 1000, '📶'), CONV('khz2mhz', 'kHz', 'MHz', (n) => n / 1000, '📶'),
  CONV('mhz2ghz', 'MHz', 'GHz', (n) => n / 1000, '📶'),
  CONV('lyr2km', 'light-yr', 'km', (n) => n * 9.461e12, '🌌'), CONV('au2km', 'AU', 'km', (n) => n * 1.496e8, '🪐'),
  CONV('mi2m', 'mi', 'm', (n) => n * 1609.34, '📏'), CONV('m2in', 'm', 'in', (n) => n * 39.3701, '📏'),

  // ---- 🧮 MATH 2 (qmath4) ----
  { name: 'arcsin', category: 'qmath4', description: 'Inverse sine → degrees', run: ({ argv }) => { const [n] = nums(argv); if (n < -1 || n > 1) throw new Error('Value must be −1…1'); return `📐 = **${round(Math.asin(n) * 180 / Math.PI, 3)}°**`; } },
  { name: 'arccos', category: 'qmath4', description: 'Inverse cosine → degrees', run: ({ argv }) => { const [n] = nums(argv); if (n < -1 || n > 1) throw new Error('Value must be −1…1'); return `📐 = **${round(Math.acos(n) * 180 / Math.PI, 3)}°**`; } },
  { name: 'arctan', category: 'qmath4', description: 'Inverse tangent → degrees', run: ({ argv }) => { const [n] = nums(argv); if (n == null) throw new Error('Usage: `?arctan 1`'); return `📐 = **${round(Math.atan(n) * 180 / Math.PI, 3)}°**`; } },
  { name: 'npr', aliases: ['permutations'], category: 'qmath4', description: 'Permutations nPr: ?npr <n> <r>', run: ({ argv }) => { const [n, r] = need2(argv, 2, '?npr 5 2'); if (r > n || n > 170) throw new Error('r ≤ n ≤ 170'); let p = 1; for (let i = 0; i < r; i++) p *= (n - i); return `🔢 ${n}P${r} = **${p}**`; } },
  { name: 'ncr', aliases: ['combinations', 'choose2'], category: 'qmath4', description: 'Combinations nCr: ?ncr <n> <r>', run: ({ argv }) => { const [n, r] = need2(argv, 2, '?ncr 5 2'); if (r > n || n > 170) throw new Error('r ≤ n ≤ 170'); let p = 1; for (let i = 0; i < r; i++) p = p * (n - i) / (i + 1); return `🔢 ${n}C${r} = **${Math.round(p)}**`; } },
  { name: 'reciprocal', category: 'qmath4', description: '1 divided by a number', run: ({ argv }) => { const [n] = nums(argv); if (!n) throw new Error('Usage: `?reciprocal 4`'); return `➗ 1/${n} = **${round(1 / n, 6)}**`; } },
  { name: 'modulo', aliases: ['mod'], category: 'qmath4', description: 'Remainder: ?modulo <a> <b>', run: ({ argv }) => { const [a, b] = need2(argv, 2, '?modulo 17 5'); if (!b) throw new Error('Cannot mod by 0'); return `➗ ${a} mod ${b} = **${a % b}**`; } },
  { name: 'sign', category: 'qmath4', description: 'Sign of a number', run: ({ argv }) => { const [n] = nums(argv); if (n == null) throw new Error('Usage: `?sign -5`'); return `± = **${Math.sign(n)}** (${n > 0 ? 'positive' : n < 0 ? 'negative' : 'zero'})`; } },
  { name: 'geomean', category: 'qmath4', description: 'Geometric mean of a list', run: ({ argv }) => { const n = nums(argv); if (!n.length || n.some((x) => x <= 0)) throw new Error('Positive numbers only'); return `📊 = **${round(Math.pow(n.reduce((a, b) => a * b, 1), 1 / n.length), 4)}**`; } },
  { name: 'roundup', aliases: ['ceil'], category: 'qmath4', description: 'Round up', run: ({ argv }) => { const [n] = nums(argv); if (n == null) throw new Error('Usage: `?roundup 4.2`'); return `⬆️ **${Math.ceil(n)}**`; } },
  { name: 'rounddown', aliases: ['floor'], category: 'qmath4', description: 'Round down', run: ({ argv }) => { const [n] = nums(argv); if (n == null) throw new Error('Usage: `?rounddown 4.8`'); return `⬇️ **${Math.floor(n)}**`; } },
  { name: 'quadratic', aliases: ['quad'], category: 'qmath4', description: 'Solve ax²+bx+c: ?quadratic <a> <b> <c>', run: ({ argv }) => { const [a, b, c] = need2(argv, 3, '?quadratic 1 -3 2'); if (!a) throw new Error('a cannot be 0'); const d = b * b - 4 * a * c; if (d < 0) return '📐 No real roots (discriminant < 0)'; const s = Math.sqrt(d); return `📐 x = **${round((-b + s) / (2 * a), 4)}** or **${round((-b - s) / (2 * a), 4)}**`; } },
  { name: 'conevol', category: 'qmath4', description: 'Cone volume: ?conevol <r> <h>', run: ({ argv }) => { const [r, h] = need2(argv, 2, '?conevol 3 9'); return `🍦 Volume = **${round(Math.PI * r * r * h / 3, 3)}**`; } },
  { name: 'trapezoid', category: 'qmath4', description: 'Trapezoid area: ?trapezoid <a> <b> <h>', run: ({ argv }) => { const [a, b, h] = need2(argv, 3, '?trapezoid 4 6 5'); return `📐 Area = **${round((a + b) / 2 * h, 3)}**`; } },
  { name: 'ellipsearea', category: 'qmath4', description: 'Ellipse area: ?ellipsearea <a> <b>', run: ({ argv }) => { const [a, b] = need2(argv, 2, '?ellipsearea 5 3'); return `⭕ Area = **${round(Math.PI * a * b, 3)}**`; } },
  { name: 'triangular', category: 'qmath4', description: 'Nth triangular number', run: ({ argv }) => { const [n] = nums(argv); if (n == null || n < 0) throw new Error('Usage: `?triangular 10`'); return `🔺 T(${n}) = **${n * (n + 1) / 2}**`; } },
  { name: 'isarmstrong', category: 'qmath4', description: 'Is it an Armstrong number?', run: ({ argv }) => { const [n] = nums(argv); if (n == null || n < 0) throw new Error('Usage: `?isarmstrong 153`'); const d = String(n).split(''); const s = d.reduce((a, c) => a + (+c) ** d.length, 0); return `${s === n ? '✅' : '❌'} ${n} is ${s === n ? '' : 'not '}an Armstrong number.`; } },
  { name: 'isperfectnum', category: 'qmath4', description: 'Is it a perfect number?', run: ({ argv }) => { const [n] = nums(argv); if (!n || n < 1 || n > 1e7) throw new Error('Usage: `?isperfectnum 28`'); let s = 0; for (let i = 1; i < n; i++) if (n % i === 0) s += i; return `${s === n ? '✅' : '❌'} ${n} is ${s === n ? '' : 'not '}perfect.`; } },
  { name: 'pctof', category: 'qmath4', description: 'What % is a of b: ?pctof <a> <b>', run: ({ argv }) => { const [a, b] = need2(argv, 2, '?pctof 30 120'); if (!b) throw new Error('b cannot be 0'); return `📊 ${a} is **${round(a / b * 100, 2)}%** of ${b}`; } },
  { name: 'pctchange', category: 'qmath4', description: '% change: ?pctchange <old> <new>', run: ({ argv }) => { const [o, n] = need2(argv, 2, '?pctchange 80 100'); if (!o) throw new Error('old cannot be 0'); const c = (n - o) / o * 100; return `📈 **${c >= 0 ? '+' : ''}${round(c, 2)}%**`; } },
  { name: 'lcmlist', category: 'qmath4', description: 'LCM of a list', run: ({ argv }) => { const n = nums(argv).map(Math.abs).filter(Boolean); if (n.length < 2) throw new Error('Usage: `?lcmlist 4 6 8`'); const g = (a, b) => b ? g(b, a % b) : a; return `🔗 LCM = **${n.reduce((a, b) => a * b / g(a, b))}**`; } },
  { name: 'gcdlist', category: 'qmath4', description: 'GCD of a list', run: ({ argv }) => { const n = nums(argv).map(Math.abs).filter(Boolean); if (n.length < 2) throw new Error('Usage: `?gcdlist 12 18 24`'); const g = (a, b) => b ? g(b, a % b) : a; return `➗ GCD = **${n.reduce(g)}**`; } },
  { name: 'ispow2', category: 'qmath4', description: 'Is it a power of 2?', run: ({ argv }) => { const [n] = nums(argv); if (n == null) throw new Error('Usage: `?ispow2 64`'); const p = n > 0 && (n & (n - 1)) === 0; return `${p ? '✅' : '❌'} ${n} is ${p ? '' : 'not '}a power of 2.`; } },

  // ---- 🔐 CIPHERS 2 (qcipher2) ----
  { name: 'vigenere', category: 'qcipher2', description: 'Vigenère encode: ?vigenere <key> <text>', run: ({ argv, args }) => { const key = argv[0]; if (!key) throw new Error('Usage: `?vigenere lemon attack`'); return vig(args.replace(/^\s*\S+\s*/, ''), key, 1); } },
  { name: 'unvigenere', aliases: ['devigenere'], category: 'qcipher2', description: 'Vigenère decode: ?unvigenere <key> <text>', run: ({ argv, args }) => { const key = argv[0]; if (!key) throw new Error('Usage: `?unvigenere lemon lxfopv`'); return vig(args.replace(/^\s*\S+\s*/, ''), key, -1); } },
  { name: 'rot5', category: 'qcipher2', description: 'ROT5 (rotate digits)', run: ({ args }) => need(args, '?rot5 12345').replace(/\d/g, (d) => (+d + 5) % 10) },
  { name: 'rot18', category: 'qcipher2', description: 'ROT13 letters + ROT5 digits', run: ({ args }) => need(args, '?rot18 abc123').replace(/[a-z]/gi, (c) => { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode((c.charCodeAt(0) - b + 13) % 26 + b); }).replace(/\d/g, (d) => (+d + 5) % 10) },
  { name: 'braille', category: 'qcipher2', description: 'Text → Braille', run: ({ args }) => [...need(args, '?braille hello').toLowerCase()].map((c) => { const i = c.charCodeAt(0) - 97; return i >= 0 && i < 26 ? BRAILLE[i] : c; }).join('') },
  { name: 'upsidedown', aliases: ['fliptext'], category: 'qcipher2', description: 'Flip text nd”', run: ({ args }) => { const M = { a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ᴉ', j: 'ɾ', k: 'ʞ', l: 'l', m: 'ɯ', n: 'u', o: 'o', p: 'd', q: 'b', r: 'ɹ', s: 's', t: 'ʇ', u: 'n', v: 'ʌ', w: 'ʍ', x: 'x', y: 'ʎ', z: 'z' }; return [...need(args, '?upsidedown hello').toLowerCase()].map((c) => M[c] || c).reverse().join(''); } },
  { name: 'keypad', aliases: ['t9'], category: 'qcipher2', description: 'Text → phone keypad digits', run: ({ args }) => { const T = { a: 2, b: 2, c: 2, d: 3, e: 3, f: 3, g: 4, h: 4, i: 4, j: 5, k: 5, l: 5, m: 6, n: 6, o: 6, p: 7, q: 7, r: 7, s: 7, t: 8, u: 8, v: 8, w: 9, x: 9, y: 9, z: 9 }; return [...need(args, '?keypad hi').toLowerCase()].map((c) => T[c] || c).join(''); } },
  { name: 'zalgo', aliases: ['glitch'], category: 'qcipher2', description: 'C̸̽o̴r̵r̶u̷p̸t̵ text', run: ({ args }) => [...need(args, '?zalgo spooky')].map((c) => c + '̸̽͢'.slice(0, rint(1, 3))).join('') },

  // ---- ✂️ STRING TOOLS 2 (qstr2) ----
  { name: 'consonants', category: 'qstr2', description: 'Count the consonants', run: ({ args }) => `🔤 **${(need(args, '?consonants text').match(/[bcdfghjklmnpqrstvwxyz]/gi) || []).length}** consonants` },
  { name: 'sentences', category: 'qstr2', description: 'Count sentences', run: ({ args }) => `📝 **${(need(args, '?sentences Hi. Bye!').match(/[.!?]+/g) || []).length}** sentences` },
  { name: 'ispalin', aliases: ['palindrome'], category: 'qstr2', description: 'Is it a palindrome?', run: ({ args }) => { const s = need(args, '?ispalin racecar').toLowerCase().replace(/[^a-z0-9]/g, ''); const p = s === [...s].reverse().join(''); return `${p ? '✅' : '❌'} ${p ? 'Yes' : 'No'}, ${p ? 'it is' : 'not'} a palindrome.`; } },
  { name: 'firstchar', category: 'qstr2', description: 'First character', run: ({ args }) => [...need(args, '?firstchar hello')][0] },
  { name: 'lastchar', category: 'qstr2', description: 'Last character', run: ({ args }) => { const a = [...need(args, '?lastchar hello')]; return a[a.length - 1]; } },
  { name: 'doublechars', aliases: ['stretch'], category: 'qstr2', description: 'Dooouuubbllee every character', run: ({ args }) => [...need(args, '?doublechars hi')].map((c) => c + c).join('') },
  { name: 'alphabetize', aliases: ['sortchars'], category: 'qstr2', description: 'Sort the letters', run: ({ args }) => [...need(args, '?alphabetize zebra')].sort().join('') },
  { name: 'avgwordlen', category: 'qstr2', description: 'Average word length', run: ({ args }) => { const w = need(args, '?avgwordlen some longer words').split(/\s+/); return `📏 Avg word length = **${round(w.reduce((a, x) => a + x.length, 0) / w.length, 2)}**`; } },
  { name: 'shortestword', category: 'qstr2', description: 'The shortest word', run: ({ args }) => need(args, '?shortestword a bb ccc').split(/\s+/).sort((a, b) => a.length - b.length)[0] },
  { name: 'reverseeach', category: 'qstr2', description: 'Reverse each word', run: ({ args }) => need(args, '?reverseeach hello world').split(/\s+/).map((w) => [...w].reverse().join('')).join(' ') },
  { name: 'countword', category: 'qstr2', description: 'Count a word: ?countword <word> <text>', run: ({ argv, args }) => { const w = argv[0]; if (!w || argv.length < 2) throw new Error('Usage: `?countword the the cat the dog`'); const rest = args.replace(/^\s*\S+\s*/, '').toLowerCase().split(/\s+/); return `🔁 "${w}" appears **${rest.filter((x) => x === w.toLowerCase()).length}×**`; } },
  { name: 'middlechar', category: 'qstr2', description: 'Middle character(s)', run: ({ args }) => { const a = [...need(args, '?middlechar hello')]; const m = a.length / 2; return a.length % 2 ? a[Math.floor(m)] : a[m - 1] + a[m]; } },
  { name: 'titlewords', aliases: ['everycap'], category: 'qstr2', description: 'Capitalize Every Word', run: ({ args }) => need(args, '?titlewords hello there').replace(/\b\w/g, (c) => c.toUpperCase()) },
  { name: 'wordsstarting', category: 'qstr2', description: 'Words starting with a letter: ?wordsstarting <l> <text>', run: ({ argv, args }) => { const l = (argv[0] || '').toLowerCase(); if (!l || argv.length < 2) throw new Error('Usage: `?wordsstarting s some silly sentence`'); return args.replace(/^\s*\S+\s*/, '').split(/\s+/).filter((w) => w.toLowerCase().startsWith(l)).join(' ') || '(none)'; } },
  { name: 'abbreviate', category: 'qstr2', description: 'First 3 letters of each word', run: ({ args }) => need(args, '?abbreviate international business machines').split(/\s+/).map((w) => w.slice(0, 3)).join('') },

  // ---- ⏰ TIME 2 (qtime2) ----
  { name: 'daysbetween', category: 'qtime2', description: 'Days between two dates', run: ({ argv }) => { if (argv.length < 2) throw new Error('Usage: `?daysbetween 2026-01-01 2026-12-31`'); const a = new Date(argv[0]), b = new Date(argv[1]); if (isNaN(a) || isNaN(b)) throw new Error('Use YYYY-MM-DD'); return `⏳ **${Math.abs(Math.round((b - a) / 86400000))}** days apart`; } },
  { name: 'isweekend', category: 'qtime2', description: 'Is a date a weekend?', run: ({ args }) => { const d = new Date(need(args, '?isweekend 2026-08-08')); if (isNaN(d)) throw new Error('Use YYYY-MM-DD'); const w = d.getUTCDay() === 0 || d.getUTCDay() === 6; return `${w ? '🎉' : '💼'} ${w ? 'Weekend!' : 'Weekday.'}`; } },
  { name: 'quarter', category: 'qtime2', description: 'Which fiscal quarter is now', run: () => `📊 Q${Math.floor(new Date().getUTCMonth() / 3) + 1} of ${new Date().getUTCFullYear()}` },
  { name: 'zodiac', category: 'qtime2', description: 'Zodiac sign from MM-DD', run: ({ args }) => { const [m, d] = need(args, '?zodiac 08-15').split(/[-/]/).map(Number); const z = [['Capricorn', 20], ['Aquarius', 19], ['Pisces', 21], ['Aries', 20], ['Taurus', 21], ['Gemini', 21], ['Cancer', 23], ['Leo', 23], ['Virgo', 23], ['Libra', 23], ['Scorpio', 22], ['Sagittarius', 22]]; const s = d < z[m - 1][1] ? z[(m + 10) % 12][0] : z[m - 1][0]; return `♈ ${s}`; } },
  { name: 'chinesezodiac', aliases: ['czodiac'], category: 'qtime2', description: 'Chinese zodiac from a year', run: ({ argv }) => { const [y] = nums(argv); if (!y) throw new Error('Usage: `?chinesezodiac 2000`'); const a = ['Monkey', 'Rooster', 'Dog', 'Pig', 'Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat']; return `🐲 Year of the **${a[y % 12]}**`; } },
  { name: 'season', category: 'qtime2', description: 'Season from MM-DD (N. hemisphere)', run: ({ args }) => { const [m] = need(args, '?season 07-01').split(/[-/]/).map(Number); return '🍃 ' + (['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer', 'Summer', 'Summer', 'Autumn', 'Autumn', 'Autumn', 'Winter'][m - 1]); } },
  { name: 'weekofyear', category: 'qtime2', description: 'Current week number', run: () => { const n = new Date(); const s = new Date(Date.UTC(n.getUTCFullYear(), 0, 1)); return `📅 Week **${Math.ceil((((n - s) / 86400000) + s.getUTCDay() + 1) / 7)}** of the year`; } },
  { name: 'secondstoday', category: 'qtime2', description: 'Seconds since midnight (UTC)', run: () => { const n = new Date(); return `⏱️ **${n.getUTCHours() * 3600 + n.getUTCMinutes() * 60 + n.getUTCSeconds()}** seconds into the day (UTC)`; } },
  { name: 'untilweekend', category: 'qtime2', description: 'Days until Saturday', run: () => { const d = (6 - new Date().getUTCDay() + 7) % 7; return `🎉 **${d === 0 ? 'It\'s the weekend!' : d + ' day(s)'}** until Saturday`; } },
  { name: 'hoursin', category: 'qtime2', description: 'Hours in N days', run: ({ argv }) => { const [n] = nums(argv); if (n == null) throw new Error('Usage: `?hoursin 3`'); return `⏰ ${n} days = **${n * 24}** hours`; } },

  // ---- 🎲 GENERATORS 3 (qgen3) ----
  { name: 'lotto', aliases: ['lottonumbers'], category: 'qgen3', description: 'Random lottery numbers', run: () => { const s = new Set(); while (s.size < 6) s.add(rint(1, 49)); return '🎰 ' + [...s].sort((a, b) => a - b).join(' · '); } },
  { name: 'randcountry', category: 'qgen3', description: 'A random country', run: () => '🌍 ' + pick(['Japan', 'Brazil', 'Canada', 'Kenya', 'Norway', 'Egypt', 'India', 'Peru', 'Iceland', 'Vietnam', 'Morocco', 'Chile']) },
  { name: 'randfood', category: 'qgen3', description: 'A random food', run: () => '🍽️ ' + pick(['🍕 pizza', '🌮 tacos', '🍜 ramen', '🍔 burger', '🍣 sushi', '🥟 dumplings', '🍝 pasta', '🧇 waffles', '🌯 burrito', '🥘 curry']) },
  { name: 'randjob', category: 'qgen3', description: 'A random job', run: () => '💼 ' + pick(['astronaut', 'chef', 'game dev', 'marine biologist', 'pilot', 'architect', 'DJ', 'firefighter', 'detective', 'barista']) },
  { name: 'randfruit', category: 'qgen3', description: 'A random fruit', run: () => pick(['🍎', '🍌', '🍇', '🍓', '🥝', '🍍', '🥭', '🍑', '🍒', '🫐']) },
  { name: 'catchphrase', category: 'qgen3', description: 'A random catchphrase', run: () => '💬 ' + pick(['Let\'s get it!', 'Easy money.', 'Built different.', 'No cap.', 'Locked in.', 'To the moon!', 'Game over.', 'Say less.']) },
  { name: 'randyear', category: 'qgen3', description: 'A random year', run: () => '📅 ' + rint(1900, 2100) },
  { name: 'randmonth', category: 'qgen3', description: 'A random month', run: () => '📅 ' + pick(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']) },
  { name: 'rolladv', aliases: ['advantage'], category: 'qgen3', description: 'Roll 2d20, take the higher', run: () => { const a = rint(1, 20), b = rint(1, 20); return `🎲 [${a}, ${b}] → **${Math.max(a, b)}** (advantage)`; } },
  { name: 'rolldis', aliases: ['disadvantage'], category: 'qgen3', description: 'Roll 2d20, take the lower', run: () => { const a = rint(1, 20), b = rint(1, 20); return `🎲 [${a}, ${b}] → **${Math.min(a, b)}** (disadvantage)`; } },
  { name: 'coinstreak', category: 'qgen3', description: 'Flip until tails', run: () => { let h = 0; while (Math.random() < 0.5) h++; return `🪙 ${h} heads in a row before tails!`; } },
  { name: 'randip', category: 'qgen3', description: 'A random (fake) IP', run: () => '🌐 `' + Array.from({ length: 4 }, () => rint(0, 255)).join('.') + '`' },
  { name: 'macaddr', category: 'qgen3', description: 'A random MAC address', run: () => '🔌 `' + Array.from({ length: 6 }, () => rint(0, 255).toString(16).padStart(2, '0')).join(':') + '`' },
  { name: 'hexstr', category: 'qgen3', description: '?hexstr [len] — random hex string', run: ({ argv }) => { const n = Math.min(64, Math.max(4, nums(argv)[0] || 16)); return '`' + Array.from({ length: n }, () => rint(0, 15).toString(16)).join('') + '`'; } },
  { name: 'randbool', aliases: ['truefalse'], category: 'qgen3', description: 'Random true or false', run: () => Math.random() < 0.5 ? '✅ true' : '❌ false' },
  { name: 'spinner', category: 'qgen3', description: 'Spin a 0–360° wheel', run: () => `🎯 The spinner landed on **${rint(0, 360)}°**` },
  { name: 'roulette', category: 'qgen3', description: 'Spin a roulette wheel', run: () => { const n = rint(0, 36); const color = n === 0 ? '🟢 green' : ([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n) ? '🔴 red' : '⚫ black'); return `🎡 **${n}** ${color}`; } },
  { name: 'dartscore', category: 'qgen3', description: 'Throw 3 darts', run: () => { const t = () => pick([...Array(20).keys()].map((i) => i + 1).concat([25, 50])); const d = [t(), t(), t()]; return `🎯 [${d.join(', ')}] = **${d.reduce((a, b) => a + b, 0)}**`; } },
  { name: 'randcolorname', category: 'qgen3', description: 'A random color name', run: () => '🎨 ' + pick(['Crimson', 'Teal', 'Amber', 'Indigo', 'Coral', 'Olive', 'Lavender', 'Turquoise', 'Maroon', 'Chartreuse']) },

  // ---- 🔠 KAOMOJI 2 (qstyle2) ----
  { name: 'happy2', category: 'qstyle2', description: '(◕‿◕)', run: () => '(◕‿◕)' },
  { name: 'angry', category: 'qstyle2', description: 'ノ(ಠ益ಠ)ノ', run: () => 'ヽ(ಠ益ಠ)ノ' },
  { name: 'love2', category: 'qstyle2', description: '(♡°▽°♡)', run: () => '(♡°▽°♡)' },
  { name: 'dead2', category: 'qstyle2', description: '(x_x)', run: () => '(x_x)' },
  { name: 'cool2', category: 'qstyle2', description: '(⌐■_■)', run: () => '(⌐■_■)' },
  { name: 'wink', category: 'qstyle2', description: '(^_~)', run: () => '(^_~)' },
  { name: 'magic2', category: 'qstyle2', description: '✨ヽ(°◇° )ノ✨', run: () => '✨ヽ(°◇° )ノ✨' },
  { name: 'cat2', category: 'qstyle2', description: '=^･ω･^=', run: () => '=^･ω･^=' },
  { name: 'dog2', category: 'qstyle2', description: '▼・ᴥ・▼', run: () => '▼・ᴥ・▼' },
  { name: 'salute', category: 'qstyle2', description: 'o7', run: () => 'o7' },
  { name: 'hug', category: 'qstyle2', description: '⊂((・▽・))⊃', run: () => '⊂((・▽・))⊃' },
  { name: 'flex', category: 'qstyle2', description: 'ᕦ(ò_óˇ)ᕤ', run: () => 'ᕦ(ò_óˇ)ᕤ' },
  { name: 'sparkles', category: 'qstyle2', description: '✧･ﾟ: *✧', run: () => '✧･ﾟ: *✧･ﾟ:*' },
  { name: 'confused', category: 'qstyle2', description: '(・_・?)', run: () => '(・_・ ?)' },

  // ---- final stretch → 1,000 (all functional) ----
  CONV('mi2nmi', 'mi', 'nmi', (n) => n * 0.868976, '⚓'), CONV('cm2ft', 'cm', 'ft', (n) => n * 0.0328084, '📏'),
  CONV('ft2cm', 'ft', 'cm', (n) => n * 30.48, '📏'), CONV('st2lb', 'st', 'lb', (n) => n * 14, '⚖️'),
  CONV('acre2ha', 'acre', 'ha', (n) => n * 0.404686, '🌾'), CONV('days2min', 'days', 'min', (n) => n * 1440, '⏱️'),
  CONV('l2m3', 'L', 'm³', (n) => n / 1000, '🥤'),
  { name: 'slope', category: 'qmath4', description: 'Line slope: ?slope <x1> <y1> <x2> <y2>', run: ({ argv }) => { const [a, b, c, d] = need2(argv, 4, '?slope 0 0 2 4'); if (c === a) throw new Error('Vertical line — undefined slope'); return `📐 Slope = **${round((d - b) / (c - a), 4)}**`; } },
  { name: 'midpoint', category: 'qmath4', description: 'Midpoint: ?midpoint <x1> <y1> <x2> <y2>', run: ({ argv }) => { const [a, b, c, d] = need2(argv, 4, '?midpoint 0 0 4 6'); return `📍 Midpoint = **(${round((a + c) / 2, 3)}, ${round((b + d) / 2, 3)})**`; } },
  { name: 'nthroot', category: 'qmath4', description: 'Nth root: ?nthroot <n> <x>', run: ({ argv }) => { const [n, x] = need2(argv, 2, '?nthroot 3 27'); if (!n) throw new Error('n cannot be 0'); return `√ = **${round(Math.sign(x) * Math.pow(Math.abs(x), 1 / n), 5)}**`; } },
  { name: 'harmean', category: 'qmath4', description: 'Harmonic mean of a list', run: ({ argv }) => { const n = nums(argv).filter((x) => x !== 0); if (!n.length) throw new Error('Usage: `?harmean 1 2 4`'); return `📊 = **${round(n.length / n.reduce((a, b) => a + 1 / b, 0), 4)}**`; } },
  { name: 'spoiler', aliases: ['spoil'], category: 'qstr2', description: 'Wrap text in a ||spoiler||', run: ({ args }) => '||' + need(args, '?spoiler secret') + '||' },
  { name: 'codeblock', aliases: ['code'], category: 'qstr2', description: 'Wrap text in a code block', run: ({ args }) => ['```', need(args, '?codeblock hello'), '```'].join('\n') },
  { name: 'quoteblock', aliases: ['blockquote'], category: 'qstr2', description: 'Turn text into a > quote', run: ({ args }) => '> ' + need(args, '?quoteblock words').replace(/\n/g, '\n> ') },
  { name: 'yay', category: 'qstyle2', description: '\\(^o^)/', run: () => '\\(^o^)/' },
  { name: 'facepalm', category: 'qstyle2', description: '(－‸ლ)', run: () => '(－‸ლ)' },
  { name: 'dance2', category: 'qstyle2', description: '♪┏(・o･)┛♪', run: () => '♪┏(・o･)┛♪♪┗ ( ・o・) ┓♪' },
  { name: 'strong', aliases: ['muscle'], category: 'qstyle2', description: 'ᕙ(⇀‸↼‶)ᕗ', run: () => 'ᕙ(⇀‸↼‶)ᕗ' },

  // =================== TOWARD 1,500 (all functional) ===================
  // ---- ⚛️ PHYSICS / ENGINEERING FORMULAS (qphys) ----
  { name: 'kinetic', aliases: ['ke'], category: 'qphys', description: 'Kinetic energy ½mv²: ?kinetic <m> <v>', run: ({ argv }) => { const [m, v] = need2(argv, 2, '?kinetic 10 5'); return `⚡ KE = **${round(0.5 * m * v * v, 3)} J**`; } },
  { name: 'potential', aliases: ['pe'], category: 'qphys', description: 'Potential energy mgh: ?potential <m> <h>', run: ({ argv }) => { const [m, h] = need2(argv, 2, '?potential 10 5'); return `⚡ PE = **${round(m * 9.81 * h, 3)} J**`; } },
  { name: 'force', category: 'qphys', description: 'Force F=ma: ?force <m> <a>', run: ({ argv }) => { const [m, a] = need2(argv, 2, '?force 10 2'); return `💪 F = **${round(m * a, 3)} N**`; } },
  { name: 'work', category: 'qphys', description: 'Work W=Fd: ?work <force> <distance>', run: ({ argv }) => { const [f, d] = need2(argv, 2, '?work 20 5'); return `🔧 W = **${round(f * d, 3)} J**`; } },
  { name: 'powerp', category: 'qphys', description: 'Power P=W/t: ?powerp <work> <time>', run: ({ argv }) => { const [w, t] = need2(argv, 2, '?powerp 100 10'); if (!t) throw new Error('time cannot be 0'); return `🔋 P = **${round(w / t, 3)} W**`; } },
  { name: 'momentum', category: 'qphys', description: 'Momentum p=mv: ?momentum <m> <v>', run: ({ argv }) => { const [m, v] = need2(argv, 2, '?momentum 10 5'); return `🎱 p = **${round(m * v, 3)} kg·m/s**`; } },
  { name: 'density', category: 'qphys', description: 'Density ρ=m/V: ?density <mass> <volume>', run: ({ argv }) => { const [m, vv] = need2(argv, 2, '?density 100 20'); if (!vv) throw new Error('volume cannot be 0'); return `🧱 ρ = **${round(m / vv, 3)} kg/m³**`; } },
  { name: 'pressurep', category: 'qphys', description: 'Pressure P=F/A: ?pressurep <force> <area>', run: ({ argv }) => { const [f, a] = need2(argv, 2, '?pressurep 100 5'); if (!a) throw new Error('area cannot be 0'); return `🎈 P = **${round(f / a, 3)} Pa**`; } },
  { name: 'ohmv', category: 'qphys', description: 'Ohm\'s law V=IR: ?ohmv <current> <resistance>', run: ({ argv }) => { const [i, r] = need2(argv, 2, '?ohmv 2 5'); return `🔌 V = **${round(i * r, 3)} V**`; } },
  { name: 'ohmi', category: 'qphys', description: 'Ohm\'s law I=V/R: ?ohmi <voltage> <resistance>', run: ({ argv }) => { const [v, r] = need2(argv, 2, '?ohmi 10 5'); if (!r) throw new Error('R cannot be 0'); return `🔌 I = **${round(v / r, 3)} A**`; } },
  { name: 'ohmr', category: 'qphys', description: 'Ohm\'s law R=V/I: ?ohmr <voltage> <current>', run: ({ argv }) => { const [v, i] = need2(argv, 2, '?ohmr 10 2'); if (!i) throw new Error('I cannot be 0'); return `🔌 R = **${round(v / i, 3)} Ω**`; } },
  { name: 'epower', category: 'qphys', description: 'Electrical power P=VI: ?epower <voltage> <current>', run: ({ argv }) => { const [v, i] = need2(argv, 2, '?epower 120 2'); return `⚡ P = **${round(v * i, 3)} W**`; } },
  { name: 'wavespeed', category: 'qphys', description: 'Wave speed v=fλ: ?wavespeed <freq> <wavelength>', run: ({ argv }) => { const [f, w] = need2(argv, 2, '?wavespeed 500 0.68'); return `🌊 v = **${round(f * w, 3)} m/s**`; } },
  { name: 'springf', category: 'qphys', description: 'Spring force F=kx: ?springf <k> <x>', run: ({ argv }) => { const [k, x] = need2(argv, 2, '?springf 200 0.1'); return `🌀 F = **${round(k * x, 3)} N**`; } },
  { name: 'gravforce', category: 'qphys', description: 'Gravity F=Gm₁m₂/r²: ?gravforce <m1> <m2> <r>', run: ({ argv }) => { const [a, b, r] = need2(argv, 3, '?gravforce 5.97e24 70 6.37e6'); if (!r) throw new Error('r cannot be 0'); return `🪐 F = **${(6.674e-11 * a * b / (r * r)).toExponential(3)} N**`; } },
  { name: 'centripetal', category: 'qphys', description: 'Centripetal a=v²/r: ?centripetal <v> <r>', run: ({ argv }) => { const [v, r] = need2(argv, 2, '?centripetal 10 2'); if (!r) throw new Error('r cannot be 0'); return `🎡 a = **${round(v * v / r, 3)} m/s²**`; } },
  { name: 'torque', category: 'qphys', description: 'Torque τ=Fr: ?torque <force> <radius>', run: ({ argv }) => { const [f, r] = need2(argv, 2, '?torque 50 0.3'); return `🔩 τ = **${round(f * r, 3)} N·m**`; } },
  { name: 'heatq', category: 'qphys', description: 'Heat Q=mcΔT: ?heatq <m> <c> <deltaT>', run: ({ argv }) => { const [m, c, t] = need2(argv, 3, '?heatq 2 4186 20'); return `🔥 Q = **${round(m * c * t, 3)} J**`; } },
  { name: 'weight', category: 'qphys', description: 'Weight W=mg: ?weight <mass>', run: ({ argv }) => { const [m] = nums(argv); if (m == null) throw new Error('Usage: `?weight 70`'); return `⚖️ W = **${round(m * 9.81, 3)} N**`; } },
  { name: 'accel', category: 'qphys', description: 'Acceleration a=Δv/t: ?accel <deltaV> <time>', run: ({ argv }) => { const [v, t] = need2(argv, 2, '?accel 20 4'); if (!t) throw new Error('time cannot be 0'); return `🏎️ a = **${round(v / t, 3)} m/s²**`; } },
  { name: 'efficiency', category: 'qphys', description: 'Efficiency: ?efficiency <output> <input>', run: ({ argv }) => { const [o, i] = need2(argv, 2, '?efficiency 80 100'); if (!i) throw new Error('input cannot be 0'); return `📊 Efficiency = **${round(o / i * 100, 2)}%**`; } },
  { name: 'molarity', category: 'qphys', description: 'Molarity M=mol/L: ?molarity <moles> <liters>', run: ({ argv }) => { const [m, l] = need2(argv, 2, '?molarity 2 4'); if (!l) throw new Error('liters cannot be 0'); return `🧪 M = **${round(m / l, 4)} mol/L**`; } },
  { name: 'ph', category: 'qphys', description: 'pH from [H⁺]: ?ph <concentration>', run: ({ argv }) => { const [h] = nums(argv); if (!(h > 0)) throw new Error('Usage: `?ph 0.0001`'); return `🧪 pH = **${round(-Math.log10(h), 3)}**`; } },
  { name: 'escapevel', category: 'qphys', description: 'Escape velocity: ?escapevel <mass> <radius>', run: ({ argv }) => { const [m, r] = need2(argv, 2, '?escapevel 5.97e24 6.37e6'); if (!r) throw new Error('r cannot be 0'); return `🚀 v = **${round(Math.sqrt(2 * 6.674e-11 * m / r), 2)} m/s**`; } },
  { name: 'freefall', category: 'qphys', description: 'Free-fall distance ½gt²: ?freefall <time>', run: ({ argv }) => { const [t] = nums(argv); if (t == null) throw new Error('Usage: `?freefall 3`'); return `🪂 Distance = **${round(0.5 * 9.81 * t * t, 3)} m**`; } },

  // ---- 📐 CONVERSIONS 3 (niche but real) ----
  CONV('parsec2ly', 'pc', 'ly', (n) => n * 3.26156, '🌌'), CONV('ly2pc', 'ly', 'pc', (n) => n / 3.26156, '🌌'),
  CONV('angstrom2nm', 'Å', 'nm', (n) => n / 10, '🔬'), CONV('micron2mm', 'µm', 'mm', (n) => n / 1000, '🔬'),
  CONV('furlong2m', 'furlong', 'm', (n) => n * 201.168, '🐎'), CONV('fathom2m', 'fathom', 'm', (n) => n * 1.8288, '⚓'),
  CONV('league2km', 'league', 'km', (n) => n * 4.828, '🗺️'), CONV('cubit2cm', 'cubit', 'cm', (n) => n * 45.72, '📏'),
  CONV('hand2cm', 'hand', 'cm', (n) => n * 10.16, '🐴'), CONV('rod2m', 'rod', 'm', (n) => n * 5.0292, '📏'),
  CONV('chain2m', 'chain', 'm', (n) => n * 20.1168, '📏'), CONV('carat2g', 'ct', 'g', (n) => n * 0.2, '💎'),
  CONV('troyoz2g', 'troy-oz', 'g', (n) => n * 31.1035, '🥇'), CONV('grain2mg', 'grain', 'mg', (n) => n * 64.7989, '⚖️'),
  CONV('slug2kg', 'slug', 'kg', (n) => n * 14.5939, '⚖️'), CONV('dram2g', 'dram', 'g', (n) => n * 1.77185, '⚖️'),
  CONV('cwt2kg', 'cwt', 'kg', (n) => n * 50.8023, '⚖️'), CONV('quintal2kg', 'quintal', 'kg', (n) => n * 100, '⚖️'),
  CONV('barrel2l', 'bbl', 'L', (n) => n * 158.987, '🛢️'), CONV('therm2mj', 'therm', 'MJ', (n) => n * 105.506, '🔥'),
  CONV('ev2j', 'eV', 'J', (n) => n * 1.602e-19, '⚛️'), CONV('cal2kj', 'kcal', 'kJ', (n) => n * 4.184, '🍎'),
  CONV('knot2ms', 'kn', 'm/s', (n) => n * 0.514444, '⚓'), CONV('c2mph', 'lightspeed', 'mph', (n) => n * 670616629, '💫'),
  CONV('acre2sqft', 'acre', 'sq-ft', (n) => n * 43560, '🌾'), CONV('sqmi2acre', 'sq-mi', 'acre', (n) => n * 640, '🌾'),
  CONV('m3tolitre', 'm³', 'L', (n) => n * 1000, '🥤'), CONV('l2pint', 'L', 'pt', (n) => n * 2.11338, '🍺'),
  CONV('rpm2rad', 'RPM', 'rad/s', (n) => n * 0.10472, '🔄'), CONV('rad2rpm', 'rad/s', 'RPM', (n) => n / 0.10472, '🔄'),
  CONV('nm2lbft', 'N·m', 'lb·ft', (n) => n * 0.737562, '🔩'), CONV('lbft2nm', 'lb·ft', 'N·m', (n) => n * 1.35582, '🔩'),
  CONV('cc2ci', 'cc', 'cu-in', (n) => n * 0.0610237, '🏎️'), CONV('kwh2mj', 'kWh', 'MJ', (n) => n * 3.6, '⚡'),
  CONV('gb2gib', 'GB', 'GiB', (n) => n * 0.931323, '💾'), CONV('mbps2mbs', 'Mbps', 'MB/s', (n) => n / 8, '📡'),

  // ---- 🎲 GENERATORS 4 (qgen4) ----
  { name: 'element', aliases: ['randelement'], category: 'qgen4', description: 'A random chemical element', run: () => '⚗️ ' + pick(['Hydrogen', 'Helium', 'Carbon', 'Oxygen', 'Iron', 'Gold', 'Neon', 'Uranium', 'Silicon', 'Sodium', 'Copper', 'Argon']) },
  { name: 'greekletter', aliases: ['greek'], category: 'qgen4', description: 'A random Greek letter', run: () => pick(['α alpha', 'β beta', 'γ gamma', 'δ delta', 'ε epsilon', 'θ theta', 'λ lambda', 'π pi', 'σ sigma', 'φ phi', 'ω omega', 'Ψ psi']) },
  { name: 'gemstone', aliases: ['gem'], category: 'qgen4', description: 'A random gemstone', run: () => '💎 ' + pick(['Ruby', 'Sapphire', 'Emerald', 'Diamond', 'Amethyst', 'Topaz', 'Opal', 'Garnet', 'Jade', 'Onyx']) },
  { name: 'dinosaur', aliases: ['dino'], category: 'qgen4', description: 'A random dinosaur', run: () => '🦖 ' + pick(['T-Rex', 'Velociraptor', 'Triceratops', 'Stegosaurus', 'Brachiosaurus', 'Ankylosaurus', 'Spinosaurus', 'Pterodactyl']) },
  { name: 'mythical', category: 'qgen4', description: 'A random mythical creature', run: () => '🐉 ' + pick(['Dragon', 'Phoenix', 'Griffin', 'Unicorn', 'Kraken', 'Minotaur', 'Hydra', 'Pegasus', 'Cerberus', 'Sphinx']) },
  { name: 'spell', aliases: ['spellname'], category: 'qgen4', description: 'A random spell name', run: () => '✨ ' + pick(['Fireball', 'Frost Nova', 'Chain Lightning', 'Arcane Blast', 'Shadow Bolt', 'Healing Light', 'Time Warp', 'Meteor']) },
  { name: 'potion', category: 'qgen4', description: 'A random potion', run: () => '🧪 Potion of ' + pick(['Healing', 'Invisibility', 'Strength', 'Fire Resistance', 'Night Vision', 'Levitation', 'Luck', 'Speed']) },
  { name: 'weather2', aliases: ['randweather'], category: 'qgen4', description: 'A random weather condition', run: () => pick(['☀️ Sunny', '🌧️ Rainy', '⛈️ Stormy', '❄️ Snowy', '🌫️ Foggy', '🌪️ Windy', '⛅ Cloudy', '🌈 Rainbow']) },
  { name: 'chessopen', category: 'qgen4', description: 'A random chess opening', run: () => '♟️ ' + pick(['Sicilian Defense', 'Ruy Lopez', 'Queen\'s Gambit', 'King\'s Indian', 'French Defense', 'Caro-Kann', 'Italian Game', 'London System']) },
  { name: 'guildname', category: 'qgen4', description: 'A random guild name', run: () => '🛡️ ' + pick(['Order of the', 'Knights of', 'Legion of', 'Clan of the', 'Brotherhood of']) + ' ' + pick(['Dawn', 'Shadow', 'Iron', 'Storm', 'Ember', 'Frost']) },
  { name: 'zodiacsign', aliases: ['randzodiac'], category: 'qgen4', description: 'A random zodiac sign', run: () => pick(['♈ Aries', '♉ Taurus', '♊ Gemini', '♋ Cancer', '♌ Leo', '♍ Virgo', '♎ Libra', '♏ Scorpio', '♐ Sagittarius', '♑ Capricorn', '♒ Aquarius', '♓ Pisces']) },
  { name: 'tarotcard', aliases: ['tarot'], category: 'qgen4', description: 'Draw a tarot card', run: () => '🔮 ' + pick(['The Fool', 'The Magician', 'The Star', 'The Moon', 'The Sun', 'The Tower', 'Death', 'The Lovers', 'Wheel of Fortune', 'The World']) },
  { name: 'rune', category: 'qgen4', description: 'A random rune', run: () => pick(['ᚠ Fehu', 'ᚢ Uruz', 'ᚦ Thurisaz', 'ᚨ Ansuz', 'ᚱ Raidho', 'ᚲ Kenaz', 'ᚷ Gebo', 'ᚹ Wunjo', 'ᛗ Mannaz', 'ᛟ Othala']) },
  { name: 'metal', category: 'qgen4', description: 'A random metal', run: () => '🔩 ' + pick(['Titanium', 'Steel', 'Copper', 'Aluminum', 'Platinum', 'Tungsten', 'Bronze', 'Cobalt', 'Nickel', 'Zinc']) },
  { name: 'constellation', category: 'qgen4', description: 'A random constellation', run: () => '⭐ ' + pick(['Orion', 'Ursa Major', 'Cassiopeia', 'Scorpius', 'Leo', 'Draco', 'Andromeda', 'Cygnus', 'Lyra', 'Pegasus']) },
  { name: 'magicnum', aliases: ['lucky2'], category: 'qgen4', description: 'Your lucky number today', run: ({ message }) => `🍀 ${message.member?.displayName || message.author.username}'s lucky number: **${rint(1, 100)}**` },
  { name: 'diceset', category: 'qgen4', description: 'Roll a full RPG dice set', run: () => `🎲 d4:${rint(1, 4)} d6:${rint(1, 6)} d8:${rint(1, 8)} d10:${rint(1, 10)} d12:${rint(1, 12)} d20:${rint(1, 20)}` },

  // ---- 🧮 MATH 5 (more geometry / number theory) ----
  { name: 'hexarea', category: 'qmath5', description: 'Regular hexagon area (side)', run: ({ argv }) => { const [s] = nums(argv); if (s == null) throw new Error('Usage: `?hexarea 4`'); return `⬡ Area = **${round(3 * Math.sqrt(3) / 2 * s * s, 3)}**`; } },
  { name: 'pentarea', category: 'qmath5', description: 'Regular pentagon area (side)', run: ({ argv }) => { const [s] = nums(argv); if (s == null) throw new Error('Usage: `?pentarea 4`'); return `⬠ Area = **${round(0.25 * Math.sqrt(5 * (5 + 2 * Math.sqrt(5))) * s * s, 3)}**`; } },
  { name: 'polygonarea', category: 'qmath5', description: 'Regular polygon area: ?polygonarea <sides> <length>', run: ({ argv }) => { const [n, s] = need2(argv, 2, '?polygonarea 6 4'); if (n < 3) throw new Error('Need 3+ sides'); return `🔷 Area = **${round(n * s * s / (4 * Math.tan(Math.PI / n)), 3)}**`; } },
  { name: 'conesurface', category: 'qmath5', description: 'Cone surface area: ?conesurface <r> <h>', run: ({ argv }) => { const [r, h] = need2(argv, 2, '?conesurface 3 4'); return `🍦 Surface = **${round(Math.PI * r * (r + Math.hypot(r, h)), 3)}**`; } },
  { name: 'spherearea', category: 'qmath5', description: 'Sphere surface area (radius)', run: ({ argv }) => { const [r] = nums(argv); if (r == null) throw new Error('Usage: `?spherearea 5`'); return `🔵 Surface = **${round(4 * Math.PI * r * r, 3)}**`; } },
  { name: 'torusvol', category: 'qmath5', description: 'Torus volume: ?torusvol <R> <r>', run: ({ argv }) => { const [R, r] = need2(argv, 2, '?torusvol 5 2'); return `🍩 Volume = **${round(2 * Math.PI * Math.PI * R * r * r, 3)}**`; } },
  { name: 'zscore', category: 'qmath5', description: 'Z-score: ?zscore <value> <mean> <stddev>', run: ({ argv }) => { const [x, m, s] = need2(argv, 3, '?zscore 85 70 10'); if (!s) throw new Error('stddev cannot be 0'); return `📊 z = **${round((x - m) / s, 3)}**`; } },
  { name: 'nextprime', category: 'qmath5', description: 'Next prime after a number', run: ({ argv }) => { let [n] = nums(argv); if (n == null || n > 1e7) throw new Error('Usage: `?nextprime 20`'); const isP = (x) => { if (x < 2) return false; for (let i = 2; i * i <= x; i++) if (x % i === 0) return false; return true; }; do { n++; } while (!isP(n)); return `🔢 Next prime = **${n}**`; } },
  { name: 'issquare', category: 'qmath5', description: 'Is it a perfect square?', run: ({ argv }) => { const [n] = nums(argv); if (n == null || n < 0) throw new Error('Usage: `?issquare 144`'); const r = Math.sqrt(n); return `${r === Math.floor(r) ? '✅' : '❌'} ${n} is ${r === Math.floor(r) ? '' : 'not '}a perfect square.`; } },
  { name: 'digitcount', category: 'qmath5', description: 'Number of digits', run: ({ argv }) => { const [n] = nums(argv); if (n == null) throw new Error('Usage: `?digitcount 12345`'); return `🔢 **${String(Math.abs(n)).replace('.', '').length}** digits`; } },
  { name: 'romanize', aliases: ['toroman'], category: 'qmath5', description: 'Number → Roman numerals', run: ({ argv }) => { let [n] = nums(argv); if (!n || n < 1 || n > 3999) throw new Error('Usage: `?romanize 2024` (1–3999)'); const R = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let out = ''; for (const [v, s] of R) while (n >= v) { out += s; n -= v; } return `🏛️ **${out}**`; } },
  { name: 'circlesector', category: 'qmath5', description: 'Circle sector area: ?circlesector <r> <angle°>', run: ({ argv }) => { const [r, a] = need2(argv, 2, '?circlesector 5 90'); return `🥧 Area = **${round(a / 360 * Math.PI * r * r, 3)}**`; } },

  // ---- 😀 KAOMOJI LIBRARY (qkao) ----
  { name: 'joy', category: 'qkao', description: '(＾▽＾)', run: () => '(＾▽＾)' },
  { name: 'grin', category: 'qkao', description: '(≧▽≦)', run: () => '(≧▽≦)' },
  { name: 'blush', category: 'qkao', description: '(⁄ ⁄•⁄ω⁄•⁄ ⁄)', run: () => '(⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)' },
  { name: 'smug', category: 'qkao', description: '( ͡~ ͜ʖ ͡°)', run: () => '( ͡~ ͜ʖ ͡°)' },
  { name: 'sob', category: 'qkao', description: '(っ˘̩╭╮˘̩)っ', run: () => '(っ˘̩╭╮˘̩)っ' },
  { name: 'pout', category: 'qkao', description: '(๑•̀ㅂ•́)', run: () => '(๑•̀ㅂ•́)و✧' },
  { name: 'rage', category: 'qkao', description: '(╬ Ò﹏Ó)', run: () => '(╬ Ò﹏Ó)' },
  { name: 'shock', category: 'qkao', description: '(⊙_⊙)', run: () => '(⊙_⊙)' },
  { name: 'faint', category: 'qkao', description: '(x_x)⌒☆', run: () => '(x_x)⌒☆' },
  { name: 'dizzy', category: 'qkao', description: '(@_@)', run: () => '(@_@)' },
  { name: 'love3', category: 'qkao', description: '(♥ω♥*)', run: () => '(♥ω♥*)' },
  { name: 'kiss2', category: 'qkao', description: '(╯3╰)', run: () => '(っ˘з(˘⌣˘ )' },
  { name: 'think', category: 'qkao', description: '(¬_¬)', run: () => '(¬_¬ )' },
  { name: 'meh', category: 'qkao', description: '(￣ヘ￣)', run: () => '(￣ヘ￣)' },
  { name: 'sweat', category: 'qkao', description: '(￣▽￣;)', run: () => '(￣▽￣;)' },
  { name: 'nervous', category: 'qkao', description: '(⌒_⌒;)', run: () => '(⌒_⌒;)' },
  { name: 'run3', category: 'qkao', description: 'ᕕ( ᐛ )ᕗ', run: () => 'ᕕ( ᐛ )ᕗ' },
  { name: 'sleep2', category: 'qkao', description: '(－ω－) zzZ', run: () => '(－ω－) zzZ' },
  { name: 'wave3', category: 'qkao', description: '( ´ ▽ ` )ﾉ', run: () => '( ´ ▽ ` )ﾉ' },
  { name: 'bow', category: 'qkao', description: 'm(_ _)m', run: () => 'm(_ _)m' },
  { name: 'pray', category: 'qkao', description: '(-人-)', run: () => '(-人-)' },
  { name: 'party', category: 'qkao', description: '☆*:.｡.o(≧▽≦)o.｡.:*☆', run: () => '☆*:.｡.o(≧▽≦)o.｡.:*☆' },
  { name: 'star2', category: 'qkao', description: '(★ω★)', run: () => '(★ω★)' },
  { name: 'cat3', category: 'qkao', description: '(=^･ｪ･^=)', run: () => '(=^･ｪ･^=)' },
  { name: 'bear2', category: 'qkao', description: 'ʕ ·(エ)· ʔ', run: () => 'ʕ ·(エ)· ʔ' },
  { name: 'bunny', category: 'qkao', description: '(=ᵔᴥᵔ=)', run: () => '(\\(\\ (=ᵔᴥᵔ=)' },
  { name: 'pig2', category: 'qkao', description: '( ᴥ )', run: () => '( ͡°(oo)͡° )' },
  { name: 'owl', category: 'qkao', description: '{@,@}', run: () => '(◉Θ◉)' },
  { name: 'fish3', category: 'qkao', description: '><(((º>', run: () => '><(((º>' },
  { name: 'monster', category: 'qkao', description: '٩(๑ơ ₃ ơ)۶', run: () => '٩(๑ơ ₃ ơ)۶' },
  { name: 'alien', category: 'qkao', description: '(⊙෴⊙)', run: () => '(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧' },
  { name: 'robot2', category: 'qkao', description: '[¬º-°]¬', run: () => '[¬º-°]¬' },
  { name: 'devil2', category: 'qkao', description: '(◣_◢)', run: () => '(◣_◢)' },
  { name: 'punch', category: 'qkao', description: '(ง •̀_•́)ง', run: () => '(ง •̀_•́)ง' },
  { name: 'fight3', category: 'qkao', description: '(」°ロ°)」', run: () => '(」°ロ°)」' },
  { name: 'boom2', category: 'qkao', description: '( ͡ಠ ʖ̯ ͡ಠ)', run: () => '💥( ゜Д゜)💥' },
  { name: 'cheer', category: 'qkao', description: '\\(≧▽≦)/', run: () => '\\(≧▽≦)/' },
  { name: 'proud', category: 'qkao', description: 'ᕦ(ò_óˇ)ᕤ', run: () => '(*￣▽￣)b' },
  { name: 'shy', category: 'qkao', description: '(⁄ ⁄>⁄ ᗨ ⁄<⁄ ⁄)', run: () => '(*/ω＼*)' },
  { name: 'whistle', category: 'qkao', description: '(＾▽＾)～♪', run: () => '(っ・ω・）っ～♪' },
  { name: 'sparkleface', category: 'qkao', description: '(✧ω✧)', run: () => '(✧ω✧)' },
  { name: 'wink4', category: 'qkao', description: '(^_-)≡☆', run: () => '(^_-)≡☆' },
  { name: 'evil2', category: 'qkao', description: 'ψ(｀∇´)ψ', run: () => 'ψ(｀∇´)ψ' },
  { name: 'innocent', category: 'qkao', description: '(◡‿◡✿)', run: () => '(◡‿◡✿)' },
  { name: 'sneaky', category: 'qkao', description: '(¬‿¬)', run: () => '(¬‿¬)' },
  { name: 'confused2', category: 'qkao', description: '(´･_･`)', run: () => '(´･_･`)' },
  { name: 'scared', category: 'qkao', description: '(ﾟﾛﾟ)', run: () => '(⊃﹏⊂)' },
  { name: 'cooldude', category: 'qkao', description: '(⌐▨_▨)', run: () => '(⌐▨_▨)' },
  { name: 'dead3', category: 'qkao', description: '(✖╭╮✖)', run: () => '(✖╭╮✖)' },
  { name: 'hearts', category: 'qkao', description: '(づ￣ ³￣)づ', run: () => '(づ￣ ³￣)づ' },
  { name: 'giveheart', category: 'qkao', description: '(♡μ_μ)', run: () => '(っ˘з(˘⌣˘ )♡' },

  // =================== FROM cmds FILE — real calculators ===================
  // ---- ✈️ AVIATION (qaero) ----
  { name: 'machcone', category: 'qaero', description: 'Mach cone half-angle: ?machcone <mach>', run: ({ argv }) => { const [m] = nums(argv); if (m == null) throw new Error('Usage: `?machcone 2`'); if (m <= 1) return `✈️ Mach ${m} is subsonic — no shockwave cone.`; return `💥 Mach ${m} → cone half-angle **${round(Math.asin(1 / m) * 180 / Math.PI, 2)}°**`; } },
  { name: 'machnum', aliases: ['mach'], category: 'qaero', description: 'Mach number: ?machnum <TAS m/s> <sound m/s>', run: ({ argv }) => { const [tas, a = 340.29] = nums(argv); if (tas == null) throw new Error('Usage: `?machnum 300 340`'); return `✈️ Mach **${round(tas / a, 3)}**`; } },
  { name: 'crosswind', category: 'qaero', description: 'Crosswind + headwind: ?crosswind <wind> <angle°>', run: ({ argv }) => { const [w, ang] = need2(argv, 2, '?crosswind 20 30'); const r = ang * Math.PI / 180; return `🌬️ Crosswind **${round(w * Math.sin(r), 1)}** · Headwind **${round(w * Math.cos(r), 1)}**`; } },
  { name: 'glidedist', aliases: ['glideratio'], category: 'qaero', description: 'Glide distance: ?glidedist <altitude> <L/D ratio>', run: ({ argv }) => { const [alt, ld] = need2(argv, 2, '?glidedist 3000 15'); return `🛩️ Glide range ≈ **${round(alt * ld, 0)}** (same units as altitude)`; } },
  { name: 'liftforce', category: 'qaero', description: 'Lift: ?liftforce <Cl> <density> <velocity> <area>', run: ({ argv }) => { const [cl, rho, v, a] = need2(argv, 4, '?liftforce 1.2 1.225 60 16'); return `🛫 Lift = **${round(0.5 * rho * v * v * cl * a, 1)} N**`; } },
  { name: 'dragforce', category: 'qaero', description: 'Drag: ?dragforce <Cd> <density> <velocity> <area>', run: ({ argv }) => { const [cd, rho, v, a] = need2(argv, 4, '?dragforce 0.03 1.225 60 16'); return `🪂 Drag = **${round(0.5 * rho * v * v * cd * a, 1)} N**`; } },
  { name: 'turnradius', category: 'qaero', description: 'Turn radius: ?turnradius <velocity m/s> <bank°>', run: ({ argv }) => { const [v, b] = need2(argv, 2, '?turnradius 100 45'); const t = Math.tan(b * Math.PI / 180); if (!t) throw new Error('bank cannot be 0'); return `🔄 Radius = **${round(v * v / (9.81 * t), 1)} m**`; } },
  { name: 'stallspeed', category: 'qaero', description: 'Stall speed: ?stallspeed <weight N> <Clmax> <density> <area>', run: ({ argv }) => { const [w, cl, rho, s] = need2(argv, 4, '?stallspeed 10000 1.5 1.225 16'); return `⚠️ Stall speed ≈ **${round(Math.sqrt(2 * w / (rho * s * cl)), 1)} m/s**`; } },
  { name: 'loadfactor', aliases: ['gforce'], category: 'qaero', description: 'Bank angle → G load: ?loadfactor <bank°>', run: ({ argv }) => { const [b] = nums(argv); if (b == null || b >= 90) throw new Error('Usage: `?loadfactor 60` (<90)'); return `🎢 Load factor = **${round(1 / Math.cos(b * Math.PI / 180), 2)} G**`; } },
  { name: 'reynolds', category: 'qaero', description: 'Reynolds number: ?reynolds <density> <velocity> <length> <viscosity>', run: ({ argv }) => { const [rho, v, l, mu] = need2(argv, 4, '?reynolds 1.225 50 1 1.8e-5'); if (!mu) throw new Error('viscosity cannot be 0'); return `🌀 Re = **${(rho * v * l / mu).toExponential(3)}**`; } },
  { name: 'climbgrad', category: 'qaero', description: 'Climb gradient: ?climbgrad <climb rate> <ground speed>', run: ({ argv }) => { const [c, g] = need2(argv, 2, '?climbgrad 500 120'); if (!g) throw new Error('speed cannot be 0'); return `📈 Climb gradient = **${round(c / g * 100, 2)}%**`; } },

  // ---- 🏎️ AUTOMOTIVE (qauto) ----
  { name: 'horsepower', aliases: ['hp'], category: 'qauto', description: 'HP from torque: ?horsepower <torque lb-ft> <rpm>', run: ({ argv }) => { const [t, r] = need2(argv, 2, '?horsepower 300 5000'); return `🏎️ **${round(t * r / 5252, 1)} HP**`; } },
  { name: 'torquehp', category: 'qauto', description: 'Torque from HP: ?torquehp <hp> <rpm>', run: ({ argv }) => { const [h, r] = need2(argv, 2, '?torquehp 400 6000'); if (!r) throw new Error('rpm cannot be 0'); return `🔧 **${round(h * 5252 / r, 1)} lb-ft**`; } },
  { name: 'pistonspeed', category: 'qauto', description: 'Mean piston speed: ?pistonspeed <stroke mm> <rpm>', run: ({ argv }) => { const [s, r] = need2(argv, 2, '?pistonspeed 86 7000'); return `⚙️ Mean piston speed = **${round(2 * (s / 1000) * r / 60, 2)} m/s**`; } },
  { name: 'displacement', aliases: ['enginesize'], category: 'qauto', description: 'Engine size: ?displacement <bore mm> <stroke mm> <cylinders>', run: ({ argv }) => { const [b, s, c] = need2(argv, 3, '?displacement 86 86 4'); const cc = Math.PI / 4 * b * b * s * c / 1000; return `🔩 Displacement = **${round(cc, 0)} cc** (${round(cc / 1000, 2)} L)`; } },
  { name: 'gearspeed', category: 'qauto', description: 'Speed in gear: ?gearspeed <rpm> <gear ratio> <final drive> <tire dia in>', run: ({ argv }) => { const [rpm, g, fd, d] = need2(argv, 4, '?gearspeed 6000 1.3 3.9 25'); const mph = rpm / (g * fd) * Math.PI * d * 60 / 63360; return `🏁 Speed ≈ **${round(mph, 1)} mph**`; } },
  { name: 'quartermile', aliases: ['et'], category: 'qauto', description: 'Quarter-mile ET: ?quartermile <hp> <weight lb>', run: ({ argv }) => { const [hp, w] = need2(argv, 2, '?quartermile 400 3200'); if (!hp) throw new Error('hp cannot be 0'); return `🏁 ¼-mile ≈ **${round(6.29 * Math.cbrt(w / hp), 2)}s** @ **${round(224 * Math.cbrt(hp / w), 1)} mph**`; } },
  { name: 'powertoweight', aliases: ['ptw'], category: 'qauto', description: 'Power-to-weight: ?powertoweight <hp> <weight lb>', run: ({ argv }) => { const [hp, w] = need2(argv, 2, '?powertoweight 400 3200'); if (!w) throw new Error('weight cannot be 0'); return `💪 **${round(hp / w * 1000, 1)} hp/1000lb** (${round(w / hp, 2)} lb/hp)`; } },
  { name: 'boosthp', category: 'qauto', description: 'HP with boost: ?boosthp <NA hp> <boost psi>', run: ({ argv }) => { const [hp, psi] = need2(argv, 2, '?boosthp 200 10'); return `💨 Boosted ≈ **${round(hp * (1 + psi / 14.7), 0)} HP**`; } },
  { name: 'brakingdist', category: 'qauto', description: 'Braking distance: ?brakingdist <speed m/s> <friction>', run: ({ argv }) => { const [v, mu] = need2(argv, 2, '?brakingdist 30 0.8'); if (!mu) throw new Error('friction cannot be 0'); return `🛑 Stopping distance = **${round(v * v / (2 * mu * 9.81), 1)} m**`; } },
  { name: 'compressionratio', aliases: ['compression'], category: 'qauto', description: 'Compression: ?compressionratio <swept> <clearance>', run: ({ argv }) => { const [s, c] = need2(argv, 2, '?compressionratio 500 50'); if (!c) throw new Error('clearance cannot be 0'); return `🔥 Ratio = **${round((s + c) / c, 2)}:1**`; } },
  { name: 'bmep', category: 'qauto', description: 'BMEP: ?bmep <torque lb-ft> <displacement L>', run: ({ argv }) => { const [t, d] = need2(argv, 2, '?bmep 300 2'); if (!d) throw new Error('displacement cannot be 0'); return `📊 BMEP ≈ **${round(t * 150.8 / d, 0)} kPa**`; } },

  // ---- 💰 FINANCE (qfin) ----
  { name: 'mortgage', aliases: ['loanpayment'], category: 'qfin', description: 'Monthly payment: ?mortgage <principal> <annual rate%> <years>', run: ({ argv }) => { const [p, rate, y] = need2(argv, 3, '?mortgage 300000 6 30'); const r = rate / 100 / 12, n = y * 12; const m = r ? p * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) : p / n; return `🏠 Monthly: **$${round(m, 2).toLocaleString()}** · Total: **$${round(m * n, 0).toLocaleString()}** over ${n} payments`; } },
  { name: 'sharpe', category: 'qfin', description: 'Sharpe ratio: ?sharpe <return%> <riskfree%> <stddev%>', run: ({ argv }) => { const [r, rf, sd] = need2(argv, 3, '?sharpe 12 3 15'); if (!sd) throw new Error('stddev cannot be 0'); return `📈 Sharpe = **${round((r - rf) / sd, 3)}**`; } },
  { name: 'roi', category: 'qfin', description: 'Return on investment: ?roi <gain> <cost>', run: ({ argv }) => { const [g, c] = need2(argv, 2, '?roi 1500 1000'); if (!c) throw new Error('cost cannot be 0'); return `📊 ROI = **${round((g - c) / c * 100, 2)}%**`; } },
  { name: 'futurevalue', aliases: ['fv'], category: 'qfin', description: 'Future value: ?futurevalue <present> <rate%> <years>', run: ({ argv }) => { const [p, r, y] = need2(argv, 3, '?futurevalue 1000 7 10'); return `💹 FV = **$${round(p * Math.pow(1 + r / 100, y), 2).toLocaleString()}**`; } },
  { name: 'apy', category: 'qfin', description: 'APR → APY: ?apy <apr%> <compounds/yr>', run: ({ argv }) => { const [apr, n] = need2(argv, 2, '?apy 5 12'); if (!n) throw new Error('compounds cannot be 0'); return `💵 APY = **${round((Math.pow(1 + apr / 100 / n, n) - 1) * 100, 3)}%**`; } },
  { name: 'rule72', category: 'qfin', description: 'Years to double: ?rule72 <rate%>', run: ({ argv }) => { const [r] = nums(argv); if (!r) throw new Error('Usage: `?rule72 6`'); return `⏳ Doubles in ≈ **${round(72 / r, 1)} years**`; } },
  { name: 'inflationadjust', aliases: ['inflation'], category: 'qfin', description: 'Inflation impact: ?inflationadjust <amount> <rate%> <years>', run: ({ argv }) => { const [a, r, y] = need2(argv, 3, '?inflationadjust 1000 3 10'); return `📉 $${a} today ≈ **$${round(a / Math.pow(1 + r / 100, y), 2).toLocaleString()}** in ${y}yr buying power`; } },
  { name: 'breakeven', category: 'qfin', description: 'Break-even units: ?breakeven <fixed> <price> <varcost>', run: ({ argv }) => { const [f, p, v] = need2(argv, 3, '?breakeven 10000 25 15'); if (p <= v) throw new Error('price must exceed variable cost'); return `⚖️ Break-even = **${Math.ceil(f / (p - v))} units**`; } },
  { name: 'pe', aliases: ['peratio'], category: 'qfin', description: 'P/E ratio: ?pe <price> <eps>', run: ({ argv }) => { const [p, e] = need2(argv, 2, '?pe 150 5'); if (!e) throw new Error('EPS cannot be 0'); return `📊 P/E = **${round(p / e, 2)}**`; } },

  // ---- 🔬 SCIENCE (qsci) ----
  { name: 'timedilation', aliases: ['lorentz'], category: 'qsci', description: 'Time dilation γ: ?timedilation <velocity as fraction of c>', run: ({ argv }) => { const [b] = nums(argv); if (b == null || b < 0 || b >= 1) throw new Error('Usage: `?timedilation 0.9` (0–0.999)'); return `🚀 γ = **${round(1 / Math.sqrt(1 - b * b), 4)}** — time runs ${round(1 / Math.sqrt(1 - b * b), 2)}× slower`; } },
  { name: 'schwarzschild', aliases: ['blackhole'], category: 'qsci', description: 'Black hole radius: ?schwarzschild <mass kg>', run: ({ argv }) => { const [m] = nums(argv); if (!(m > 0)) throw new Error('Usage: `?schwarzschild 1.989e30`'); return `🕳️ Event horizon radius = **${round(2 * 6.674e-11 * m / (299792458 ** 2), 4)} m**`; } },
  { name: 'orbitalvel', category: 'qsci', description: 'Orbital velocity: ?orbitalvel <mass kg> <radius m>', run: ({ argv }) => { const [m, r] = need2(argv, 2, '?orbitalvel 5.97e24 6.7e6'); if (!r) throw new Error('radius cannot be 0'); return `🛰️ Orbital velocity = **${round(Math.sqrt(6.674e-11 * m / r), 1)} m/s**`; } },
  { name: 'surfgravity', aliases: ['gravity'], category: 'qsci', description: 'Surface gravity: ?surfgravity <mass kg> <radius m>', run: ({ argv }) => { const [m, r] = need2(argv, 2, '?surfgravity 5.97e24 6.37e6'); if (!r) throw new Error('radius cannot be 0'); return `🪐 Surface gravity = **${round(6.674e-11 * m / (r * r), 3)} m/s²**`; } },
  { name: 'halflife', category: 'qsci', description: 'Radioactive decay: ?halflife <initial> <half-life> <time>', run: ({ argv }) => { const [n0, hl, t] = need2(argv, 3, '?halflife 100 5730 11460'); if (!hl) throw new Error('half-life cannot be 0'); return `☢️ Remaining = **${round(n0 * Math.pow(0.5, t / hl), 4)}**`; } },
  { name: 'lightdelay', category: 'qsci', description: 'Light travel time: ?lightdelay <distance km>', run: ({ argv }) => { const [d] = nums(argv); if (d == null) throw new Error('Usage: `?lightdelay 384400`'); const s = d * 1000 / 299792458; return `💫 Light takes **${s < 60 ? round(s, 3) + ' s' : round(s / 60, 3) + ' min'}**`; } },
  { name: 'kepler', category: 'qsci', description: 'Orbital period: ?kepler <mass kg> <radius m>', run: ({ argv }) => { const [m, r] = need2(argv, 2, '?kepler 1.989e30 1.496e11'); if (!m) throw new Error('mass cannot be 0'); const T = 2 * Math.PI * Math.sqrt(r ** 3 / (6.674e-11 * m)); return `🌍 Orbital period = **${round(T / 86400, 2)} days**`; } },
  { name: 'redshift', category: 'qsci', description: 'Relativistic redshift: ?redshift <velocity as fraction of c>', run: ({ argv }) => { const [b] = nums(argv); if (b == null || b < 0 || b >= 1) throw new Error('Usage: `?redshift 0.1`'); return `🔴 z = **${round(Math.sqrt((1 + b) / (1 - b)) - 1, 4)}**`; } },

  // ---- 🎵 MUSIC THEORY (qmusic) ----
  { name: 'chord', category: 'qmusic', description: 'Chord notes: ?chord <root> <maj|min|dim|aug|maj7|min7|dom7>', run: ({ argv }) => { const N = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']; const root = N.indexOf((argv[0] || 'C').toUpperCase().replace('B', 'B')); if (root < 0) throw new Error('Usage: `?chord C maj`'); const T = { maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], dom7: [0, 4, 7, 10] }[(argv[1] || 'maj').toLowerCase()] || [0, 4, 7]; return `🎹 **${T.map((i) => N[(root + i) % 12]).join(' · ')}**`; } },
  { name: 'scale', category: 'qmusic', description: 'Scale notes: ?scale <root> <major|minor|penta|blues>', run: ({ argv }) => { const N = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']; const root = N.indexOf((argv[0] || 'C').toUpperCase()); if (root < 0) throw new Error('Usage: `?scale A minor`'); const T = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], penta: [0, 2, 4, 7, 9], blues: [0, 3, 5, 6, 7, 10] }[(argv[1] || 'major').toLowerCase()] || [0, 2, 4, 5, 7, 9, 11]; return `🎼 **${T.map((i) => N[(root + i) % 12]).join(' ')}**`; } },
  { name: 'transpose', category: 'qmusic', description: 'Transpose a note: ?transpose <note> <semitones>', run: ({ argv }) => { const N = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']; const i = N.indexOf((argv[0] || '').toUpperCase()); const s = Number(argv[1]); if (i < 0 || Number.isNaN(s)) throw new Error('Usage: `?transpose C 5`'); return `🎵 **${N[((i + s) % 12 + 12) % 12]}**`; } },
  { name: 'note2freq', aliases: ['notefreq'], category: 'qmusic', description: 'Note frequency: ?note2freq <A4|C5|…>', run: ({ argv }) => { const N = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']; const m = (argv[0] || '').toUpperCase().match(/^([A-G]#?)(\d)$/); if (!m) throw new Error('Usage: `?note2freq A4`'); const n = N.indexOf(m[1]) + (Number(m[2]) + 1) * 12; return `🔊 **${round(440 * Math.pow(2, (n - 69) / 12), 2)} Hz**`; } },
  { name: 'bpm2ms', category: 'qmusic', description: 'BPM → beat length: ?bpm2ms <bpm>', run: ({ argv }) => { const [b] = nums(argv); if (!b) throw new Error('Usage: `?bpm2ms 120`'); return `🥁 1 beat = **${round(60000 / b, 1)} ms** · ⅛ = ${round(30000 / b, 1)}ms · ¼ = ${round(60000 / b, 1)}ms`; } },

  // =================== BATCH 2 from cmds + real veins ===================
  // ---- ✈️ AVIATION 2 ----
  { name: 'isatemp', category: 'qaero', description: 'ISA temperature at altitude: ?isatemp <ft>', run: ({ argv }) => { const [a] = nums(argv); if (a == null) throw new Error('Usage: `?isatemp 10000`'); return `🌡️ ISA temp = **${round(15 - 1.98 * a / 1000, 1)}°C**`; } },
  { name: 'densityalt', category: 'qaero', description: 'Density altitude: ?densityalt <pressure alt ft> <OAT °C>', run: ({ argv }) => { const [pa, oat] = need2(argv, 2, '?densityalt 5000 25'); const isa = 15 - 1.98 * pa / 1000; return `🏔️ Density altitude ≈ **${round(pa + 120 * (oat - isa), 0)} ft**`; } },
  { name: 'topofdescent', aliases: ['tod'], category: 'qaero', description: 'Top of descent (3° rule): ?tod <altitude ft>', run: ({ argv }) => { const [a] = nums(argv); if (a == null) throw new Error('Usage: `?tod 35000`'); return `🛬 Begin descent **${round(a / 1000 * 3, 1)} nm** out (3° path)`; } },
  { name: 'descentrate', category: 'qaero', description: 'Descent rate for 3°: ?descentrate <groundspeed kt>', run: ({ argv }) => { const [gs] = nums(argv); if (gs == null) throw new Error('Usage: `?descentrate 250`'); return `📉 Target ≈ **${round(gs * 5, 0)} ft/min** (3° path)`; } },
  { name: 'fuelendurance', category: 'qaero', description: 'Endurance: ?fuelendurance <fuel gal> <burn gph>', run: ({ argv }) => { const [f, b] = need2(argv, 2, '?fuelendurance 50 12'); if (!b) throw new Error('burn cannot be 0'); const h = f / b; return `⛽ Endurance = **${Math.floor(h)}h ${round((h % 1) * 60, 0)}m**`; } },
  { name: 'weightcg', aliases: ['cg'], category: 'qaero', description: 'Center of gravity: ?weightcg <w1> <arm1> <w2> <arm2>…', run: ({ argv }) => { const n = nums(argv); if (n.length < 2 || n.length % 2) throw new Error('Usage: `?weightcg 500 40 200 80`'); let W = 0, M = 0; for (let i = 0; i < n.length; i += 2) { W += n[i]; M += n[i] * n[i + 1]; } if (!W) throw new Error('total weight is 0'); return `⚖️ CG = **${round(M / W, 2)}** · Total weight **${round(W, 1)}**`; } },
  { name: 'rateofclimb', aliases: ['roc'], category: 'qaero', description: 'Rate of climb: ?rateofclimb <altitude gained> <minutes>', run: ({ argv }) => { const [a, t] = need2(argv, 2, '?rateofclimb 3000 4'); if (!t) throw new Error('time cannot be 0'); return `📈 ROC = **${round(a / t, 0)} ft/min**`; } },

  // ---- 🔬 SCIENCE 2 ----
  { name: 'emc2', aliases: ['massenergy'], category: 'qsci', description: 'E=mc²: ?emc2 <mass kg>', run: ({ argv }) => { const [m] = nums(argv); if (m == null) throw new Error('Usage: `?emc2 1`'); return `☢️ E = **${(m * 299792458 ** 2).toExponential(4)} J**`; } },
  { name: 'photonenergy', aliases: ['photon'], category: 'qsci', description: 'Photon energy E=hf: ?photon <frequency Hz>', run: ({ argv }) => { const [f] = nums(argv); if (f == null) throw new Error('Usage: `?photon 5e14`'); return `💡 E = **${(6.626e-34 * f).toExponential(4)} J**`; } },
  { name: 'wavelength', category: 'qsci', description: 'Wavelength λ=v/f: ?wavelength <freq Hz> <speed m/s>', run: ({ argv }) => { const [f, v = 3e8] = nums(argv); if (f == null || !f) throw new Error('Usage: `?wavelength 5e14 3e8`'); return `🌊 λ = **${(v / f).toExponential(4)} m**`; } },
  { name: 'soundspeed', category: 'qsci', description: 'Speed of sound in air: ?soundspeed <temp °C>', run: ({ argv }) => { const [t] = nums(argv); if (t == null) throw new Error('Usage: `?soundspeed 20`'); return `🔊 Speed of sound = **${round(331.3 + 0.606 * t, 1)} m/s**`; } },
  { name: 'coulomb', category: 'qsci', description: 'Coulomb force: ?coulomb <q1> <q2> <r>', run: ({ argv }) => { const [a, b, r] = need2(argv, 3, '?coulomb 1e-6 1e-6 0.1'); if (!r) throw new Error('r cannot be 0'); return `⚡ F = **${(8.988e9 * a * b / (r * r)).toExponential(4)} N**`; } },
  { name: 'debroglie', category: 'qsci', description: 'de Broglie wavelength: ?debroglie <momentum>', run: ({ argv }) => { const [p] = nums(argv); if (!p) throw new Error('Usage: `?debroglie 1e-24`'); return `🌀 λ = **${(6.626e-34 / p).toExponential(4)} m**`; } },
  { name: 'relmass', category: 'qsci', description: 'Relativistic mass factor: ?relmass <velocity frac c>', run: ({ argv }) => { const [b] = nums(argv); if (b == null || b < 0 || b >= 1) throw new Error('Usage: `?relmass 0.8`'); return `🚀 Mass ×**${round(1 / Math.sqrt(1 - b * b), 4)}**`; } },
  { name: 'kinetictemp', category: 'qsci', description: 'Avg KE at temperature: ?kinetictemp <temp K>', run: ({ argv }) => { const [t] = nums(argv); if (t == null) throw new Error('Usage: `?kinetictemp 300`'); return `🔥 Avg KE = **${(1.5 * 1.381e-23 * t).toExponential(4)} J/particle**`; } },

  // ---- 💰 FINANCE 2 ----
  { name: 'simpleinterest', aliases: ['simpint'], category: 'qfin', description: 'Simple interest: ?simpleinterest <principal> <rate%> <years>', run: ({ argv }) => { const [p, r, t] = need2(argv, 3, '?simpleinterest 1000 5 3'); return `💵 Interest = **$${round(p * r / 100 * t, 2).toLocaleString()}** · Total **$${round(p * (1 + r / 100 * t), 2).toLocaleString()}**`; } },
  { name: 'cagr', category: 'qfin', description: 'Compound annual growth: ?cagr <start> <end> <years>', run: ({ argv }) => { const [s, e, y] = need2(argv, 3, '?cagr 1000 2000 5'); if (!s || !y) throw new Error('start/years cannot be 0'); return `📈 CAGR = **${round((Math.pow(e / s, 1 / y) - 1) * 100, 2)}%**`; } },
  { name: 'dti', category: 'qfin', description: 'Debt-to-income: ?dti <monthly debt> <monthly income>', run: ({ argv }) => { const [d, i] = need2(argv, 2, '?dti 1500 5000'); if (!i) throw new Error('income cannot be 0'); return `📊 DTI = **${round(d / i * 100, 1)}%**`; } },
  { name: 'ltv', category: 'qfin', description: 'Loan-to-value: ?ltv <loan> <value>', run: ({ argv }) => { const [l, v] = need2(argv, 2, '?ltv 240000 300000'); if (!v) throw new Error('value cannot be 0'); return `🏠 LTV = **${round(l / v * 100, 1)}%**`; } },
  { name: 'downpayment', category: 'qfin', description: 'Down payment: ?downpayment <price> <pct>', run: ({ argv }) => { const [p, d] = need2(argv, 2, '?downpayment 300000 20'); return `💰 Down = **$${round(p * d / 100, 2).toLocaleString()}** · Financing **$${round(p * (1 - d / 100), 2).toLocaleString()}**`; } },
  { name: 'takehome', aliases: ['aftertax'], category: 'qfin', description: 'After-tax pay: ?takehome <gross> <tax%>', run: ({ argv }) => { const [g, t] = need2(argv, 2, '?takehome 60000 22'); return `💵 Take-home ≈ **$${round(g * (1 - t / 100), 2).toLocaleString()}**`; } },

  // ---- 🧮 ALGORITHMS (qmath6) ----
  { name: 'primesbelow', aliases: ['sieve'], category: 'qmath6', description: 'All primes below n: ?primesbelow <n>', run: ({ argv }) => { const [n] = nums(argv); if (!n || n < 2 || n > 500) throw new Error('Usage: `?primesbelow 50` (max 500)'); const s = Array(n).fill(true); const p = []; for (let i = 2; i < n; i++) if (s[i]) { p.push(i); for (let j = i * i; j < n; j += i) s[j] = false; } return `🔢 ${p.join(', ')}`; } },
  { name: 'fizzbuzz', category: 'qmath6', description: 'FizzBuzz to n: ?fizzbuzz <n>', run: ({ argv }) => { const [n] = nums(argv); if (!n || n < 1 || n > 30) throw new Error('Usage: `?fizzbuzz 15` (max 30)'); const out = []; for (let i = 1; i <= n; i++) out.push(i % 15 === 0 ? 'FizzBuzz' : i % 3 === 0 ? 'Fizz' : i % 5 === 0 ? 'Buzz' : i); return out.join(' '); } },
  { name: 'pascalrow', category: 'qmath6', description: 'Row of Pascal\'s triangle: ?pascalrow <n>', run: ({ argv }) => { const [n] = nums(argv); if (n == null || n < 0 || n > 25) throw new Error('Usage: `?pascalrow 5` (0–25)'); const row = [1]; for (let k = 0; k < n; k++) row.push(row[k] * (n - k) / (k + 1)); return `🔺 ${row.map((x) => Math.round(x)).join(' ')}`; } },
  { name: 'fibseq', category: 'qmath6', description: 'First n Fibonacci numbers: ?fibseq <n>', run: ({ argv }) => { const [n] = nums(argv); if (!n || n < 1 || n > 30) throw new Error('Usage: `?fibseq 10` (max 30)'); const f = [0, 1]; for (let i = 2; i < n; i++) f.push(f[i - 1] + f[i - 2]); return `🌀 ${f.slice(0, n).join(', ')}`; } },
  { name: 'collatzseq', category: 'qmath6', description: 'Collatz sequence: ?collatzseq <n>', run: ({ argv }) => { let [n] = nums(argv); if (!n || n < 1 || n > 1e4) throw new Error('Usage: `?collatzseq 6`'); const seq = [n]; while (n !== 1 && seq.length < 120) { n = n % 2 ? 3 * n + 1 : n / 2; seq.push(n); } return `🔁 ${seq.join(' → ')}`; } },
  { name: 'triangle', aliases: ['nthtri'], category: 'qmath6', description: 'First n triangular numbers', run: ({ argv }) => { const [n] = nums(argv); if (!n || n < 1 || n > 30) throw new Error('Usage: `?triangle 8`'); return `🔺 ${Array.from({ length: n }, (_, i) => (i + 1) * (i + 2) / 2).join(', ')}`; } },
  { name: 'binomial', aliases: ['choose3'], category: 'qmath6', description: 'Binomial coefficient C(n,k)', run: ({ argv }) => { const [n, k] = need2(argv, 2, '?binomial 5 2'); if (k > n) throw new Error('k ≤ n'); let c = 1; for (let i = 0; i < k; i++) c = c * (n - i) / (i + 1); return `🔢 C(${n},${k}) = **${Math.round(c)}**`; } },
  { name: 'ackermann', category: 'qmath6', description: 'Ackermann A(m,n) (small only)', run: ({ argv }) => { const [m, n] = need2(argv, 2, '?ackermann 2 3'); if (m > 3 || n > 6) throw new Error('Keep m≤3, n≤6 (it explodes fast!)'); const A = (a, b) => a === 0 ? b + 1 : b === 0 ? A(a - 1, 1) : A(a - 1, A(a, b - 1)); return `🌀 A(${m},${n}) = **${A(m, n)}**`; } },

  // ---- 🃏 CARD/POKER ODDS (qgame) ----
  { name: 'potodds', category: 'qgame', description: 'Pot odds: ?potodds <pot> <call>', run: ({ argv }) => { const [p, c] = need2(argv, 2, '?potodds 100 20'); if (p + c === 0) throw new Error('bad input'); return `🃏 Pot odds = **${round(c / (p + c) * 100, 1)}%** (need this equity to call)`; } },
  { name: 'outs', aliases: ['ruleof4'], category: 'qgame', description: 'Outs → win %: ?outs <outs>', run: ({ argv }) => { const [o] = nums(argv); if (o == null || o < 0 || o > 21) throw new Error('Usage: `?outs 9`'); return `🃏 ~**${o * 4}%** by river (turn+river), ~**${o * 2}%** next card`; } },
  { name: 'blackjack', aliases: ['bjhit'], category: 'qgame', description: 'Should you hit? ?blackjack <your total> <dealer up>', run: ({ argv }) => { const [y, d] = need2(argv, 2, '?blackjack 16 10'); if (y >= 17) return '🃏 **Stand** (17+).'; if (y <= 11) return '🃏 **Hit** (can\'t bust).'; if (y >= 12 && y <= 16) return d >= 7 ? '🃏 **Hit** (dealer strong).' : '🃏 **Stand** (dealer weak).'; return '🃏 Hit.'; } },

  // ---- 😀 KAOMOJI 3 ----
  { name: 'laugh', category: 'qkao', description: '(≧∇≦)ﾉ', run: () => '(≧∇≦)ﾉ' },
  { name: 'love5', category: 'qkao', description: '(๑>◡<๑)', run: () => '(๑>◡<๑)' },
  { name: 'cool4', category: 'qkao', description: '(•_•) ( •_•)>⌐■-■ (⌐■_■)', run: () => '(•_•) ( •_•)>⌐■-■ (⌐■_■)' },
  { name: 'flip3', category: 'qkao', description: '(ﾉಥ益ಥ)ﾉ ┻━┻', run: () => '(ﾉಥ益ಥ)ﾉ ┻━┻' },
  { name: 'giggle', category: 'qkao', description: 'ᕕ(´◡`)ᕗ', run: () => '(๑˃ᴗ˂)ﻭ' },
  { name: 'wow', category: 'qkao', description: '(⊙▽⊙)', run: () => '(⊙▽⊙)' },
  { name: 'zzz', category: 'qkao', description: '(－ω－) zzZ', run: () => '(￣o￣) zzZ' },
  { name: 'wink5', category: 'qkao', description: '( ﾟ∀ﾟ)', run: () => '( ﾟ∀ﾟ)' },
  { name: 'nervous2', category: 'qkao', description: '(⌒_⌒;)', run: () => '(ノдヽ)' },
  { name: 'yay2', category: 'qkao', description: '＼(￣▽￣)／', run: () => '＼(￣▽￣)／' },
  { name: 'heartface', category: 'qkao', description: '(づ｡◕‿‿◕｡)づ', run: () => '(づ｡◕‿‿◕｡)づ' },
  { name: 'stare2', category: 'qkao', description: '(๑◔‿◔๑)', run: () => '(๑◔‿◔๑)' },

  // ---- 🎁 GENERATORS 5 (qgen4) ----
  { name: 'rpgclass', category: 'qgen4', description: 'A random RPG class', run: () => '⚔️ ' + pick(['Warrior', 'Mage', 'Rogue', 'Paladin', 'Ranger', 'Necromancer', 'Bard', 'Druid', 'Monk', 'Warlock']) },
  { name: 'rpgrace', category: 'qgen4', description: 'A random fantasy race', run: () => '🧝 ' + pick(['Human', 'Elf', 'Dwarf', 'Orc', 'Halfling', 'Tiefling', 'Dragonborn', 'Gnome', 'Goblin', 'Aasimar']) },
  { name: 'alignment', category: 'qgen4', description: 'A random D&D alignment', run: () => '⚖️ ' + pick(['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'True Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil']) },
  { name: 'superpower', category: 'qgen4', description: 'A random superpower', run: () => '💥 ' + pick(['Invisibility', 'Flight', 'Super strength', 'Telepathy', 'Time control', 'Teleportation', 'Shapeshifting', 'Telekinesis', 'Elemental control', 'Healing']) },
  { name: 'trait', aliases: ['personality'], category: 'qgen4', description: 'A random personality trait', run: () => '🧠 ' + pick(['Ambitious', 'Curious', 'Loyal', 'Reckless', 'Witty', 'Stubborn', 'Compassionate', 'Cunning', 'Optimistic', 'Mysterious']) },
  { name: 'hobby', category: 'qgen4', description: 'A random hobby', run: () => '🎨 ' + pick(['painting', 'rock climbing', 'chess', 'gardening', 'photography', 'baking', 'coding', 'guitar', 'astronomy', 'pottery']) },
  { name: 'weapon', category: 'qgen4', description: 'A random fantasy weapon', run: () => '🗡️ ' + pick(['Longsword', 'War Axe', 'Battle Staff', 'Dagger', 'Warhammer', 'Crossbow', 'Halberd', 'Rapier', 'Scythe', 'Flail']) },
  { name: 'questname', category: 'qgen4', description: 'A random quest title', run: () => '📜 ' + pick(['The Lost', 'Curse of the', 'Rise of the', 'Secrets of the', 'Wrath of the']) + ' ' + pick(['Crown', 'Shadow', 'Forgotten King', 'Ember', 'Deep', 'Serpent']) },
  { name: 'colorhex2', aliases: ['randhex'], category: 'qgen4', description: 'A random color + its hex', run: () => { const h = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'); return `🎨 #${h}`; } },
  { name: 'dreamjob', category: 'qgen4', description: 'A random dream job', run: () => '🌟 ' + pick(['Astronaut', 'Marine Biologist', 'Video Game Designer', 'Chef', 'Pilot', 'Archaeologist', 'Stunt Double', 'Volcanologist']) },

  // =================== FINAL PUSH → 1,500 (all functional) ===================
  // ---- 📐 CONVERSIONS 4 ----
  CONV('kib2mib', 'KiB', 'MiB', (n) => n / 1024, '💾'), CONV('mib2gib', 'MiB', 'GiB', (n) => n / 1024, '💾'),
  CONV('wh2j', 'Wh', 'J', (n) => n * 3600, '🔋'), CONV('j2wh', 'J', 'Wh', (n) => n / 3600, '🔋'),
  CONV('ftlb2j', 'ft-lb', 'J', (n) => n * 1.35582, '🔧'), CONV('j2ftlb', 'J', 'ft-lb', (n) => n / 1.35582, '🔧'),
  CONV('mil2mm', 'mil', 'mm', (n) => n * 0.0254, '📏'), CONV('point2mm', 'pt', 'mm', (n) => n * 0.352778, '🖨️'),
  CONV('pica2mm', 'pica', 'mm', (n) => n * 4.23333, '🖨️'), CONV('fps2kmh', 'ft/s', 'km/h', (n) => n * 1.09728, '🏃'),
  CONV('month2day', 'month', 'day', (n) => n * 30.44, '📅'), CONV('decade2yr', 'decade', 'yr', (n) => n * 10, '📅'),
  CONV('century2yr', 'century', 'yr', (n) => n * 100, '📅'), CONV('arcmin2deg', 'arcmin', 'deg', (n) => n / 60, '📐'),
  CONV('arcsec2deg', 'arcsec', 'deg', (n) => n / 3600, '📐'), CONV('tsp2tbsp', 'tsp', 'tbsp', (n) => n / 3, '🥄'),
  CONV('pint2cup', 'pt', 'cup', (n) => n * 2, '🥤'), CONV('sqft2sqin', 'sq-ft', 'sq-in', (n) => n * 144, '🟦'),
  CONV('mbar2hpa', 'mbar', 'hPa', (n) => n, '🎈'), CONV('inhg2hpa', 'inHg', 'hPa', (n) => n * 33.8639, '🎈'),
  CONV('kn2mph', 'kn', 'mph', (n) => n * 1.15078, '⚓'), CONV('cm2mm', 'cm', 'mm', (n) => n * 10, '📏'),
  CONV('mm2m', 'mm', 'm', (n) => n / 1000, '📏'), CONV('g2lb', 'g', 'lb', (n) => n / 453.592, '⚖️'),
  CONV('lb2g', 'lb', 'g', (n) => n * 453.592, '⚖️'), CONV('c2rankine', '°C', '°R', (n) => (n + 273.15) * 9 / 5, '🌡️'),
  CONV('f2rankine', '°F', '°R', (n) => n + 459.67, '🌡️'), CONV('mps2knots', 'm/s', 'kn', (n) => n * 1.94384, '⚓'),
  CONV('deg2mil', 'deg', 'mil-nato', (n) => n * 17.7778, '🎯'), CONV('yd2ft', 'yd', 'ft', (n) => n * 3, '📏'),
  CONV('gallonuk2l', 'UK-gal', 'L', (n) => n * 4.54609, '🇬🇧'), CONV('bushel2l', 'bushel', 'L', (n) => n * 35.2391, '🌾'),

  // ---- 🔢 BASE CONVERTERS + MORE MATH (qmath6) ----
  { name: 'dec2oct', category: 'qmath6', description: 'Decimal → octal', run: ({ argv }) => { const [n] = nums(argv); if (n == null) throw new Error('Usage: `?dec2oct 64`'); return `🔢 = **${Math.floor(n).toString(8)}**`; } },
  { name: 'oct2dec', category: 'qmath6', description: 'Octal → decimal', run: ({ args }) => { const n = parseInt(need(args, '?oct2dec 100'), 8); if (Number.isNaN(n)) throw new Error('Invalid octal'); return `🔢 = **${n}**`; } },
  { name: 'bin2hex', category: 'qmath6', description: 'Binary → hex', run: ({ args }) => { const n = parseInt(need(args, '?bin2hex 1010'), 2); if (Number.isNaN(n)) throw new Error('Invalid binary'); return `🔢 = **${n.toString(16).toUpperCase()}**`; } },
  { name: 'hex2bin', category: 'qmath6', description: 'Hex → binary', run: ({ args }) => { const n = parseInt(need(args, '?hex2bin FF').replace(/^0x/i, ''), 16); if (Number.isNaN(n)) throw new Error('Invalid hex'); return `🔢 = **${n.toString(2)}**`; } },
  { name: 'tobase', category: 'qmath6', description: 'Number → any base: ?tobase <n> <base 2-36>', run: ({ argv }) => { const [n, b] = need2(argv, 2, '?tobase 255 16'); if (b < 2 || b > 36) throw new Error('Base 2–36'); return `🔢 = **${Math.floor(n).toString(b).toUpperCase()}**`; } },
  { name: 'squares', category: 'qmath6', description: 'First n square numbers', run: ({ argv }) => { const [n] = nums(argv); if (!n || n < 1 || n > 30) throw new Error('Usage: `?squares 10`'); return `🔢 ${Array.from({ length: n }, (_, i) => (i + 1) ** 2).join(', ')}`; } },
  { name: 'cubes', category: 'qmath6', description: 'First n cube numbers', run: ({ argv }) => { const [n] = nums(argv); if (!n || n < 1 || n > 25) throw new Error('Usage: `?cubes 8`'); return `🔢 ${Array.from({ length: n }, (_, i) => (i + 1) ** 3).join(', ')}`; } },
  { name: 'sec', category: 'qmath6', description: 'Secant of an angle (degrees)', run: ({ argv }) => { const [d] = nums(argv); if (d == null) throw new Error('Usage: `?sec 60`'); const c = Math.cos(d * Math.PI / 180); if (!c) throw new Error('undefined'); return `📐 sec = **${round(1 / c, 5)}**`; } },
  { name: 'csc', category: 'qmath6', description: 'Cosecant of an angle (degrees)', run: ({ argv }) => { const [d] = nums(argv); if (d == null) throw new Error('Usage: `?csc 30`'); const s = Math.sin(d * Math.PI / 180); if (!s) throw new Error('undefined'); return `📐 csc = **${round(1 / s, 5)}**`; } },
  { name: 'cot', category: 'qmath6', description: 'Cotangent of an angle (degrees)', run: ({ argv }) => { const [d] = nums(argv); if (d == null) throw new Error('Usage: `?cot 45`'); const t = Math.tan(d * Math.PI / 180); if (!t) throw new Error('undefined'); return `📐 cot = **${round(1 / t, 5)}**`; } },
  { name: 'iqr', category: 'qmath6', description: 'Interquartile range of a list', run: ({ argv }) => { const n = nums(argv).sort((a, b) => a - b); if (n.length < 4) throw new Error('Need 4+ numbers'); const q = (p) => { const i = p * (n.length - 1); const lo = Math.floor(i); return n[lo] + (i - lo) * (n[lo + 1] - n[lo]); }; return `📊 IQR = **${round(q(0.75) - q(0.25), 3)}**`; } },
  { name: 'annulus', category: 'qmath6', description: 'Annulus (ring) area: ?annulus <R> <r>', run: ({ argv }) => { const [R, r] = need2(argv, 2, '?annulus 5 2'); return `⭕ Area = **${round(Math.PI * (R * R - r * r), 3)}**`; } },
  { name: 'rhombus', category: 'qmath6', description: 'Rhombus area: ?rhombus <d1> <d2>', run: ({ argv }) => { const [a, b] = need2(argv, 2, '?rhombus 6 8'); return `🔷 Area = **${round(a * b / 2, 3)}**`; } },

  // ---- ⚛️ PHYSICS 3 ----
  { name: 'projectilerange', aliases: ['projrange'], category: 'qphys', description: 'Projectile range: ?projrange <velocity> <angle°>', run: ({ argv }) => { const [v, a] = need2(argv, 2, '?projrange 20 45'); return `🎯 Range = **${round(v * v * Math.sin(2 * a * Math.PI / 180) / 9.81, 3)} m**`; } },
  { name: 'projectiletime', category: 'qphys', description: 'Projectile flight time: ?projectiletime <velocity> <angle°>', run: ({ argv }) => { const [v, a] = need2(argv, 2, '?projectiletime 20 45'); return `⏱️ Flight time = **${round(2 * v * Math.sin(a * Math.PI / 180) / 9.81, 3)} s**`; } },
  { name: 'pendulum', category: 'qphys', description: 'Pendulum period: ?pendulum <length m>', run: ({ argv }) => { const [l] = nums(argv); if (!(l > 0)) throw new Error('Usage: `?pendulum 1`'); return `🕰️ Period = **${round(2 * Math.PI * Math.sqrt(l / 9.81), 3)} s**`; } },
  { name: 'boyles', category: 'qphys', description: 'Boyle\'s law P₂: ?boyles <P1> <V1> <V2>', run: ({ argv }) => { const [p, v1, v2] = need2(argv, 3, '?boyles 100 2 1'); if (!v2) throw new Error('V2 cannot be 0'); return `🎈 P₂ = **${round(p * v1 / v2, 3)}**`; } },
  { name: 'resistorseries', category: 'qphys', description: 'Resistors in series (sum)', run: ({ argv }) => { const n = nums(argv); if (!n.length) throw new Error('Usage: `?resistorseries 100 220 330`'); return `🔌 Total = **${round(n.reduce((a, b) => a + b, 0), 3)} Ω**`; } },
  { name: 'resistorparallel', category: 'qphys', description: 'Resistors in parallel', run: ({ argv }) => { const n = nums(argv).filter((x) => x); if (!n.length) throw new Error('Usage: `?resistorparallel 100 100`'); return `🔌 Total = **${round(1 / n.reduce((a, b) => a + 1 / b, 0), 3)} Ω**`; } },
  { name: 'capenergy', category: 'qphys', description: 'Capacitor energy: ?capenergy <capacitance F> <voltage V>', run: ({ argv }) => { const [c, v] = need2(argv, 2, '?capenergy 0.001 12'); return `⚡ E = **${(0.5 * c * v * v).toExponential(4)} J**`; } },
  { name: 'dopplerfreq', category: 'qphys', description: 'Doppler shift: ?dopplerfreq <freq> <source speed> <sound speed>', run: ({ argv }) => { const [f, vs, c = 343] = nums(argv); if (f == null || vs == null) throw new Error('Usage: `?dopplerfreq 440 30 343`'); return `🚨 Approaching: **${round(f * c / (c - vs), 1)} Hz** · Receding: **${round(f * c / (c + vs), 1)} Hz**`; } },
  { name: 'terminalvel', category: 'qphys', description: 'Terminal velocity: ?terminalvel <mass> <area> <drag Cd> <density>', run: ({ argv }) => { const [m, a, cd, rho = 1.225] = nums(argv); if (m == null || a == null || cd == null) throw new Error('Usage: `?terminalvel 80 0.7 1.0 1.225`'); return `🪂 Terminal velocity = **${round(Math.sqrt(2 * m * 9.81 / (rho * a * cd)), 2)} m/s**`; } },

  // ---- 🎵 MUSIC 2 ----
  { name: 'interval', category: 'qmusic', description: 'Semitones between notes: ?interval <note1> <note2>', run: ({ argv }) => { const N = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']; const a = N.indexOf((argv[0] || '').toUpperCase()), b = N.indexOf((argv[1] || '').toUpperCase()); if (a < 0 || b < 0) throw new Error('Usage: `?interval C G`'); return `🎵 **${((b - a) % 12 + 12) % 12}** semitones`; } },
  { name: 'circleoffifths', aliases: ['fifths'], category: 'qmusic', description: 'The circle of fifths', run: () => '🎼 C → G → D → A → E → B → F# → C# → G# → D# → A# → F → C' },
  { name: 'temponame', category: 'qmusic', description: 'Tempo marking from BPM: ?temponame <bpm>', run: ({ argv }) => { const [b] = nums(argv); if (!b) throw new Error('Usage: `?temponame 120`'); const t = b < 60 ? 'Largo' : b < 76 ? 'Adagio' : b < 108 ? 'Andante' : b < 120 ? 'Moderato' : b < 168 ? 'Allegro' : b < 200 ? 'Presto' : 'Prestissimo'; return `🎵 ${b} BPM = **${t}**`; } },
  { name: 'keysig', category: 'qmusic', description: 'Sharps/flats in a key: ?keysig <key>', run: ({ argv }) => { const K = { C: '0 (natural)', G: '1 sharp', D: '2 sharps', A: '3 sharps', E: '4 sharps', B: '5 sharps', F: '1 flat', BB: '2 flats' }; const k = (argv[0] || 'C').toUpperCase(); return `🎼 ${k} major: **${K[k] || 'see circle of fifths'}**`; } },

  // ---- 😀 KAOMOJI 4 ----
  { name: 'happyface', category: 'qkao', description: '(◍•ᴗ•◍)', run: () => '(◍•ᴗ•◍)' },
  { name: 'sadface', category: 'qkao', description: '(╥﹏╥)', run: () => '( ͒˃̩̩⌂˂̩̩ ͒)' },
  { name: 'sparklelove', category: 'qkao', description: '(*♡∀♡)', run: () => '(*♡∀♡)' },
  { name: 'shrug4', category: 'qkao', description: '¯\\(°_o)/¯', run: () => '¯\\(°_o)/¯' },
  { name: 'peace2', category: 'qkao', description: '(^-^)v', run: () => '(^-^)v' },
  { name: 'grumpy', category: 'qkao', description: '(--_--)', run: () => '(-_-メ)' },
  { name: 'excited', category: 'qkao', description: '\\(★ω★)/', run: () => '\\(★ω★)/' },
  { name: 'crymore', category: 'qkao', description: '。゜(゜´Д｀゜)゜。', run: () => '。゜(゜´Д｀゜)゜。' },
  { name: 'strong2', category: 'qkao', description: 'ᕦ(ಠ‿ಠ)ᕤ', run: () => 'ᕦ(ಠ‿ಠ)ᕤ' },
  { name: 'sleepy4', category: 'qkao', description: '(¯―¯٥)', run: () => '(´-`).｡oO' },
  { name: 'kissy', category: 'qkao', description: '( ˘ ³˘)♥', run: () => '( ˘ ³˘)♥' },
  { name: 'thinking2', category: 'qkao', description: '(￢ω￢)', run: () => '(￢ω￢)' },
  { name: 'panic', category: 'qkao', description: '(ノಠ益ಠ)ノ', run: () => '⊙﹏⊙' },
  { name: 'smile2', category: 'qkao', description: '(✿◠‿◠)', run: () => '(✿◠‿◠)' },
  { name: 'facepalm3', category: 'qkao', description: '(-‸ლ)', run: () => 'ლ(ಠ益ಠ)ლ' },
  { name: 'wizardface', category: 'qkao', description: '(∩｀-´)⊃━☆ﾟ.*', run: () => '(∩｀-´)⊃━☆ﾟ.*・｡ﾟ' },
  { name: 'catlove', category: 'qkao', description: '(=^･ｪ･^=)♡', run: () => '(=^･ｪ･^=)♡' },
  { name: 'happytear', category: 'qkao', description: '(ᵔ◡ᵔ)', run: () => '(ᵔ◡ᵔ)' },
  { name: 'dance5', category: 'qkao', description: 'ヽ(⌐■_■)ノ♪♬', run: () => 'ヽ(⌐■_■)ノ♪♬' },
  { name: 'surprised', category: 'qkao', description: '(ﾟoﾟ)', run: () => '(ﾟoﾟ)' },

  // ---- 🎁 GENERATORS 6 (qgen4) ----
  { name: 'randadjective', aliases: ['adjective'], category: 'qgen4', description: 'A random adjective', run: () => pick(['sparkly', 'ancient', 'ferocious', 'gentle', 'chaotic', 'radiant', 'mysterious', 'gigantic', 'silent', 'electric', 'frozen', 'golden']) },
  { name: 'randverb', aliases: ['verb'], category: 'qgen4', description: 'A random verb', run: () => pick(['sprint', 'whisper', 'explode', 'shimmer', 'conquer', 'tumble', 'vanish', 'ignite', 'wander', 'summon']) },
  { name: 'randnoun', aliases: ['noun'], category: 'qgen4', description: 'A random noun', run: () => pick(['castle', 'thunder', 'galaxy', 'phoenix', 'mountain', 'whisper', 'engine', 'diamond', 'labyrinth', 'comet']) },
  { name: 'sport', aliases: ['randsport'], category: 'qgen4', description: 'A random sport', run: () => '🏅 ' + pick(['Soccer', 'Basketball', 'Tennis', 'Boxing', 'Surfing', 'Archery', 'Fencing', 'Rock Climbing', 'Skiing', 'Rowing']) },
  { name: 'instrument', category: 'qgen4', description: 'A random instrument', run: () => '🎺 ' + pick(['Guitar', 'Piano', 'Violin', 'Drums', 'Saxophone', 'Cello', 'Flute', 'Trumpet', 'Harp', 'Synthesizer']) },
  { name: 'drink', category: 'qgen4', description: 'A random drink', run: () => '🥤 ' + pick(['Espresso', 'Lemonade', 'Boba tea', 'Smoothie', 'Hot chocolate', 'Iced coffee', 'Matcha latte', 'Root beer', 'Milkshake']) },
  { name: 'dessert', category: 'qgen4', description: 'A random dessert', run: () => '🍰 ' + pick(['Cheesecake', 'Brownie', 'Tiramisu', 'Ice cream', 'Macarons', 'Cupcake', 'Donut', 'Crème brûlée', 'Cookie']) },
  { name: 'flower', category: 'qgen4', description: 'A random flower', run: () => '🌸 ' + pick(['Rose', 'Tulip', 'Sunflower', 'Orchid', 'Lily', 'Daisy', 'Lavender', 'Peony', 'Marigold', 'Lotus']) },
  { name: 'bird', category: 'qgen4', description: 'A random bird', run: () => '🐦 ' + pick(['Eagle', 'Robin', 'Owl', 'Falcon', 'Parrot', 'Penguin', 'Hummingbird', 'Raven', 'Flamingo', 'Peacock']) },
  { name: 'moviegenre', category: 'qgen4', description: 'A random movie genre', run: () => '🎬 ' + pick(['Sci-Fi', 'Horror', 'Rom-Com', 'Thriller', 'Fantasy', 'Documentary', 'Western', 'Noir', 'Musical', 'Heist']) },
  { name: 'martialart', category: 'qgen4', description: 'A random martial art', run: () => '🥋 ' + pick(['Karate', 'Judo', 'Muay Thai', 'BJJ', 'Taekwondo', 'Kung Fu', 'Boxing', 'Krav Maga', 'Aikido', 'Capoeira']) },
  { name: 'boardgame', category: 'qgen4', description: 'A random board game', run: () => '🎲 ' + pick(['Chess', 'Catan', 'Monopoly', 'Risk', 'Scrabble', 'Clue', 'Ticket to Ride', 'Pandemic', 'Carcassonne']) },
  { name: 'moodemoji', aliases: ['moodgen'], category: 'qgen4', description: 'A random mood emoji', run: () => pick(['😄', '😎', '🥺', '😤', '🤩', '😴', '🤔', '😇', '🥳', '😌', '🫠', '🤯']) },
  { name: 'nickname', category: 'qgen4', description: 'A random nickname', run: () => pick(['Ace', 'Blaze', 'Ghost', 'Maverick', 'Shadow', 'Viper', 'Rocket', 'Frost', 'Nova', 'Echo']) },
  { name: 'randtitle', category: 'qgen4', description: 'A random fancy title', run: () => pick(['Lord', 'Sir', 'Duke', 'Baron', 'Grandmaster', 'Captain', 'Overlord', 'Chief', 'Warden']) + ' of ' + pick(['the North', 'Ashen Valley', 'Storms', 'the Deep', 'Embers']) },

  // =================== LAST STRETCH → 1,500 ===================
  // ---- 📐 CONVERSIONS 5 ----
  CONV('oz2kg', 'oz', 'kg', (n) => n * 0.0283495, '⚖️'), CONV('kg2oz', 'kg', 'oz', (n) => n * 35.274, '⚖️'),
  CONV('km2ft', 'km', 'ft', (n) => n * 3280.84, '📏'), CONV('m2mm', 'm', 'mm', (n) => n * 1000, '📏'),
  CONV('um2nm', 'µm', 'nm', (n) => n * 1000, '🔬'), CONV('nm2um', 'nm', 'µm', (n) => n / 1000, '🔬'),
  CONV('pa2bar', 'Pa', 'bar', (n) => n / 1e5, '🎈'), CONV('bar2pa', 'bar', 'Pa', (n) => n * 1e5, '🎈'),
  CONV('atm2bar', 'atm', 'bar', (n) => n * 1.01325, '🎈'), CONV('sec2hr', 'sec', 'hr', (n) => n / 3600, '⏱️'),
  CONV('hr2day', 'hr', 'day', (n) => n / 24, '📅'), CONV('day2week', 'day', 'week', (n) => n / 7, '📅'),
  CONV('ms2sec', 'ms', 'sec', (n) => n / 1000, '⏱️'), CONV('ns2ms', 'ns', 'ms', (n) => n / 1e6, '⏱️'),
  CONV('ms2fps', 'm/s', 'ft/s', (n) => n * 3.28084, '🏃'), CONV('kj2wh', 'kJ', 'Wh', (n) => n / 3.6, '🔋'),
  CONV('ev2kev', 'eV', 'keV', (n) => n / 1000, '⚛️'), CONV('m3togal', 'm³', 'gal', (n) => n * 264.172, '🥤'),
  CONV('sqm2ha', 'sq-m', 'ha', (n) => n / 10000, '🌾'), CONV('ha2sqkm', 'ha', 'sq-km', (n) => n / 100, '🌾'),
  CONV('l2cup', 'L', 'cup', (n) => n * 4.22675, '🥤'), CONV('tsp2ml2', 'tsp', 'mL', (n) => n * 4.929, '🥄'),
  CONV('mm2in', 'mm', 'in', (n) => n / 25.4, '📏'), CONV('mile2m', 'mi', 'm', (n) => n * 1609.34, '📏'),
  CONV('cm3toml', 'cm³', 'mL', (n) => n, '🥤'), CONV('rankine2c', '°R', '°C', (n) => (n - 491.67) * 5 / 9, '🌡️'),
  CONV('grad2rad', 'grad', 'rad', (n) => n * Math.PI / 200, '📐'), CONV('deg2arcmin', 'deg', 'arcmin', (n) => n * 60, '📐'),

  // ---- ✂️ STRING TOOLS 3 (qstr2) ----
  { name: 'countupper', category: 'qstr2', description: 'Count uppercase letters', run: ({ args }) => `🔠 **${(need(args, '?countupper Hi There').match(/[A-Z]/g) || []).length}** uppercase` },
  { name: 'countlower', category: 'qstr2', description: 'Count lowercase letters', run: ({ args }) => `🔡 **${(need(args, '?countlower Hi There').match(/[a-z]/g) || []).length}** lowercase` },
  { name: 'countdigits2', aliases: ['countnums'], category: 'qstr2', description: 'Count digits in text', run: ({ args }) => `🔢 **${(need(args, '?countdigits2 a1b2c3').match(/\d/g) || []).length}** digits` },
  { name: 'countspaces', category: 'qstr2', description: 'Count spaces', run: ({ args }) => `␣ **${(need(args, '?countspaces a b c').match(/ /g) || []).length}** spaces` },
  { name: 'charat', category: 'qstr2', description: 'Character at position: ?charat <n> <text>', run: ({ argv, args }) => { const i = Number(argv[0]); const t = args.replace(/^\s*\d+\s*/, ''); if (Number.isNaN(i) || !t) throw new Error('Usage: `?charat 3 hello`'); return [...t][i - 1] || '(out of range)'; } },
  { name: 'wordat', category: 'qstr2', description: 'Word at position: ?wordat <n> <text>', run: ({ argv, args }) => { const i = Number(argv[0]); const t = args.replace(/^\s*\d+\s*/, ''); if (Number.isNaN(i) || !t) throw new Error('Usage: `?wordat 2 the quick fox`'); return t.split(/\s+/)[i - 1] || '(out of range)'; } },
  { name: 'mostcommonchar', category: 'qstr2', description: 'Most frequent character', run: ({ args }) => { const s = need(args, '?mostcommonchar hello').replace(/\s/g, ''); const f = {}; let best = s[0]; for (const c of s) { f[c] = (f[c] || 0) + 1; if (f[c] > f[best]) best = c; } return `🔁 "**${best}**" ×${f[best]}`; } },
  { name: 'snake2camel', category: 'qstr2', description: 'snake_case → camelCase', run: ({ args }) => need(args, '?snake2camel hello_world').replace(/_(.)/g, (_, c) => c.toUpperCase()) },
  { name: 'camel2snake', category: 'qstr2', description: 'camelCase → snake_case', run: ({ args }) => need(args, '?camel2snake helloWorld').replace(/([A-Z])/g, '_$1').toLowerCase() },
  { name: 'dedupechars', category: 'qstr2', description: 'Remove duplicate characters', run: ({ args }) => [...new Set([...need(args, '?dedupechars aabbcc')])].join('') },
  { name: 'reversesentence', category: 'qstr2', description: 'Reverse whole sentence', run: ({ args }) => [...need(args, '?reversesentence hello world')].reverse().join('') },
  { name: 'contains', category: 'qstr2', description: 'Does text contain a word: ?contains <word> <text>', run: ({ argv, args }) => { const w = argv[0]; const t = args.replace(/^\s*\S+\s*/, ''); if (!w || !t) throw new Error('Usage: `?contains fox the quick fox`'); return t.toLowerCase().includes(w.toLowerCase()) ? '✅ Yes' : '❌ No'; } },
  { name: 'pluralize', category: 'qstr2', description: 'Basic pluralize a word', run: ({ args }) => { const w = need(args, '?pluralize box'); if (/(s|x|z|ch|sh)$/.test(w)) return w + 'es'; if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ies'; return w + 's'; } },
  { name: 'wordsstats', aliases: ['textstats'], category: 'qstr2', description: 'Full stats on text', run: ({ args }) => { const s = need(args, '?textstats hello world'); return `📊 ${[...s].length} chars · ${s.split(/\s+/).length} words · ${(s.match(/[.!?]+/g) || []).length} sentences`; } },

  // ---- 🧮 MATH 7 (qmath6) ----
  { name: 'nthfib', category: 'qmath6', description: 'Nth Fibonacci (single): ?nthfib <n>', run: ({ argv }) => { const [n] = nums(argv); if (n == null || n < 0 || n > 78) throw new Error('Usage: `?nthfib 20`'); let a = 0, b = 1; for (let i = 0; i < n; i++) [a, b] = [b, a + b]; return `🌀 F(${n}) = **${a}**`; } },
  { name: 'digitalsum', category: 'qmath6', description: 'Sum of digits until single', run: ({ argv }) => { let [n] = nums(argv); if (n == null) throw new Error('Usage: `?digitalsum 9999`'); n = Math.abs(Math.floor(n)); let s = 0; while (n) { s += n % 10; n = Math.floor(n / 10); } return `➕ Digit sum = **${s}**`; } },
  { name: 'ishappy', category: 'qmath6', description: 'Is it a happy number?', run: ({ argv }) => { let [n] = nums(argv); if (!n || n < 1) throw new Error('Usage: `?ishappy 19`'); const seen = new Set(); while (n !== 1 && !seen.has(n)) { seen.add(n); n = String(n).split('').reduce((a, c) => a + (+c) ** 2, 0); } return `${n === 1 ? '😊 Yes' : '😞 No'}, ${n === 1 ? 'happy' : 'not happy'} number.`; } },
  { name: 'meanmedian', aliases: ['centraltend'], category: 'qmath6', description: 'Mean + median + mode of a list', run: ({ argv }) => { const n = nums(argv); if (!n.length) throw new Error('Usage: `?meanmedian 1 2 2 3 4`'); const mean = n.reduce((a, b) => a + b, 0) / n.length; const s = [...n].sort((a, b) => a - b); const med = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; return `📊 Mean **${round(mean, 2)}** · Median **${med}**`; } },
  { name: 'factorialtrail', category: 'qmath6', description: 'Trailing zeros in n!', run: ({ argv }) => { const [n] = nums(argv); if (n == null || n < 0) throw new Error('Usage: `?factorialtrail 100`'); let z = 0; for (let p = 5; p <= n; p *= 5) z += Math.floor(n / p); return `0️⃣ ${n}! has **${z}** trailing zeros`; } },
  { name: 'gcdpair', category: 'qmath6', description: 'GCD of two numbers (verbose)', run: ({ argv }) => { let [a, b] = need2(argv, 2, '?gcdpair 48 36'); a = Math.abs(a); b = Math.abs(b); const x = a, y = b; while (b) [a, b] = [b, a % b]; return `➗ gcd(${x}, ${y}) = **${a}**`; } },
  { name: 'perfectsquares', category: 'qmath6', description: 'Perfect squares up to n', run: ({ argv }) => { const [n] = nums(argv); if (!n || n < 1 || n > 1e6) throw new Error('Usage: `?perfectsquares 100`'); const out = []; for (let i = 1; i * i <= n; i++) out.push(i * i); return `🔢 ${out.join(', ')}`; } },

  // ---- ⏰ TIME 3 (qtime2) ----
  { name: 'monthname', category: 'qtime2', description: 'Current month name', run: () => '📅 ' + ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][new Date().getUTCMonth()] },
  { name: 'dayname', category: 'qtime2', description: 'Today\'s day name', run: () => '📅 ' + ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getUTCDay()] },
  { name: 'agedays', category: 'qtime2', description: 'Age in days from a date', run: ({ args }) => { const d = new Date(need(args, '?agedays 2000-01-01')); if (isNaN(d)) throw new Error('Use YYYY-MM-DD'); return `📅 **${Math.floor((Date.now() - d) / 86400000).toLocaleString()}** days`; } },
  { name: 'weeksbetween', category: 'qtime2', description: 'Weeks between two dates', run: ({ argv }) => { if (argv.length < 2) throw new Error('Usage: `?weeksbetween 2026-01-01 2026-12-31`'); const a = new Date(argv[0]), b = new Date(argv[1]); if (isNaN(a) || isNaN(b)) throw new Error('Use YYYY-MM-DD'); return `📅 **${Math.abs(Math.round((b - a) / 604800000))}** weeks`; } },
  { name: 'timeofday', category: 'qtime2', description: 'Part of day right now (UTC)', run: () => { const h = new Date().getUTCHours(); return '🕐 ' + (h < 6 ? 'Night 🌙' : h < 12 ? 'Morning ☀️' : h < 18 ? 'Afternoon 🌤️' : 'Evening 🌆') + ` (UTC ${h}h)`; } },

  // ---- ⚛️ PHYSICS 4 ----
  { name: 'springperiod', category: 'qphys', description: 'Spring oscillation period: ?springperiod <mass> <k>', run: ({ argv }) => { const [m, k] = need2(argv, 2, '?springperiod 1 100'); if (!k) throw new Error('k cannot be 0'); return `🌀 Period = **${round(2 * Math.PI * Math.sqrt(m / k), 3)} s**`; } },
  { name: 'freqperiod', category: 'qphys', description: 'Frequency from period: ?freqperiod <period s>', run: ({ argv }) => { const [t] = nums(argv); if (!t) throw new Error('Usage: `?freqperiod 0.5`'); return `📶 f = **${round(1 / t, 3)} Hz**`; } },
  { name: 'gpe', category: 'qphys', description: 'Grav. potential energy: ?gpe <mass> <height>', run: ({ argv }) => { const [m, h] = need2(argv, 2, '?gpe 10 5'); return `⛰️ PE = **${round(m * 9.81 * h, 2)} J**`; } },
  { name: 'impulse', category: 'qphys', description: 'Impulse J=Ft: ?impulse <force> <time>', run: ({ argv }) => { const [f, t] = need2(argv, 2, '?impulse 100 0.2'); return `💥 Impulse = **${round(f * t, 3)} N·s**`; } },
  { name: 'watts2hp', category: 'qphys', description: 'Watts → horsepower: ?watts2hp <watts>', run: ({ argv }) => { const [w] = nums(argv); if (w == null) throw new Error('Usage: `?watts2hp 745.7`'); return `🐎 **${round(w / 745.7, 3)} hp**`; } },

  // ---- 😀 KAOMOJI 5 ----
  { name: 'joyful', category: 'qkao', description: '(*＾▽＾)／', run: () => '(*＾▽＾)／' },
  { name: 'teary', category: 'qkao', description: '(っ- ‸ - ς)', run: () => '(っ- ‸ - ς)' },
  { name: 'cheeky', category: 'qkao', description: '(^▾^)', run: () => '( ﾟ▽ﾟ)/' },
  { name: 'sparklestar', category: 'qkao', description: '★彡', run: () => '｡･:*:･ﾟ★,｡･:*:･ﾟ☆' },
  { name: 'rocketkao', category: 'qkao', description: '~=[,,_,,]:3', run: () => '=͟͟͞͞ヽ( •̀ ω •́ )ゝ' },
  { name: 'coffeekao', category: 'qkao', description: '( ˘▽˘)っ♨', run: () => '( ˘▽˘)っ♨' },
  { name: 'musicalkao', category: 'qkao', description: '⁽⁽◝( ˙ ꒳ ˙ )◜⁾⁾', run: () => '⁽⁽◝( ˙ ꒳ ˙ )◜⁾⁾' },
  { name: 'angry5', category: 'qkao', description: '(╬`益´)', run: () => '(╬`益´)' },
  { name: 'love6', category: 'qkao', description: '(♡˙︶˙♡)', run: () => '(♡˙︶˙♡)' },
  { name: 'shocked2', category: 'qkao', description: 'Σ(ﾟﾛﾟ)', run: () => 'Σ(ﾟﾛﾟ)' },
  { name: 'proud2', category: 'qkao', description: 'd(＾▽＾)b', run: () => 'd(＾▽＾)b' },
  { name: 'derp', category: 'qkao', description: '(͠≖ ͜ʖ͠≖)', run: () => '(͠≖ ͜ʖ͠≖)' },
  { name: 'cutesy', category: 'qkao', description: '(｡•́‿•̀｡)', run: () => '(｡•́‿•̀｡)' },
  { name: 'sighkao', category: 'qkao', description: '(´ヘ｀;)', run: () => '(´ヘ｀;)' },
  { name: 'thumbsupkao', category: 'qkao', description: '(๑˃ᴗ˂)ﻭ', run: () => '(๑•̀ㅂ•́)ᕗ' },
  { name: 'crazykao', category: 'qkao', description: '(⊙ヮ⊙)', run: () => '(⊙ヮ⊙)' },
  { name: 'smugkao', category: 'qkao', description: 'ᕕ( ᐛ )ᕗ smug', run: () => '( ˙꒳​˙ )' },
  { name: 'blushkao', category: 'qkao', description: '(⁄ ⁄•⁄ω⁄•⁄ ⁄)', run: () => '(⁄ ⁄•⁄ω⁄•⁄ ⁄)' },
  { name: 'wavekao', category: 'qkao', description: '(*ﾟ▽ﾟ)ﾉ', run: () => '(*ﾟ▽ﾟ)ﾉ' },
  { name: 'starstruck', category: 'qkao', description: '☆*:.｡.(✧∀✧).｡.:*☆', run: () => '☆*:.｡.(✧∀✧).｡.:*☆' },

  // ---- 🎁 GENERATORS 7 (qgen4) ----
  { name: 'vegetable', category: 'qgen4', description: 'A random vegetable', run: () => '🥕 ' + pick(['Carrot', 'Broccoli', 'Spinach', 'Potato', 'Onion', 'Pepper', 'Corn', 'Cabbage', 'Zucchini', 'Kale']) },
  { name: 'insect', category: 'qgen4', description: 'A random insect', run: () => '🐛 ' + pick(['Butterfly', 'Beetle', 'Ant', 'Dragonfly', 'Firefly', 'Ladybug', 'Grasshopper', 'Moth', 'Mantis', 'Bee']) },
  { name: 'tree', category: 'qgen4', description: 'A random tree', run: () => '🌳 ' + pick(['Oak', 'Maple', 'Pine', 'Birch', 'Willow', 'Redwood', 'Cherry Blossom', 'Baobab', 'Cedar', 'Aspen']) },
  { name: 'ocean', aliases: ['seacreature'], category: 'qgen4', description: 'A random sea creature', run: () => '🌊 ' + pick(['Dolphin', 'Octopus', 'Shark', 'Jellyfish', 'Seahorse', 'Manta Ray', 'Narwhal', 'Anglerfish', 'Turtle', 'Orca']) },
  { name: 'cardsuit', category: 'qgen4', description: 'A random card suit', run: () => pick(['♠️ Spades', '♥️ Hearts', '♦️ Diamonds', '♣️ Clubs']) },
  { name: 'compass', aliases: ['direction'], category: 'qgen4', description: 'A random compass direction', run: () => '🧭 ' + pick(['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest']) },
  { name: 'season', category: 'qgen4', description: 'A random season', run: () => pick(['🌸 Spring', '☀️ Summer', '🍂 Autumn', '❄️ Winter']) },
  { name: 'randemotion', aliases: ['emotion'], category: 'qgen4', description: 'A random emotion', run: () => pick(['Joy', 'Anger', 'Sadness', 'Fear', 'Surprise', 'Excitement', 'Calm', 'Nostalgia', 'Curiosity', 'Awe']) },
  { name: 'randlanguage', aliases: ['language'], category: 'qgen4', description: 'A random language', run: () => '🗣️ ' + pick(['Spanish', 'Japanese', 'French', 'Swahili', 'Mandarin', 'Arabic', 'German', 'Hindi', 'Portuguese', 'Korean']) },
  { name: 'randfont', aliases: ['font'], category: 'qgen4', description: 'A random font vibe', run: () => '🔤 ' + pick(['Helvetica', 'Comic Sans', 'Times New Roman', 'Impact', 'Courier', 'Papyrus', 'Futura', 'Garamond']) },
  { name: 'randmineral', aliases: ['mineral'], category: 'qgen4', description: 'A random mineral', run: () => '🪨 ' + pick(['Quartz', 'Obsidian', 'Malachite', 'Pyrite', 'Amethyst', 'Feldspar', 'Mica', 'Gypsum', 'Calcite']) },
  { name: 'randweather3', aliases: ['forecast2'], category: 'qgen4', description: 'A random fake forecast', run: () => `🌦️ ${pick(['Sunny', 'Rainy', 'Cloudy', 'Stormy', 'Snowy', 'Windy'])}, **${rint(-5, 35)}°C**, ${rint(0, 100)}% humidity` },
  { name: 'randstat', aliases: ['statblock'], category: 'qgen4', description: 'A random character stat block', run: () => `📊 HP ${rint(50, 200)} · ATK ${rint(10, 99)} · DEF ${rint(10, 99)} · SPD ${rint(10, 99)}` },
  { name: 'coinflip3', aliases: ['besttwoofthree'], category: 'qgen4', description: 'Best 2 of 3 coin flips', run: () => { const f = [0, 0, 0].map(() => Math.random() < 0.5 ? 'H' : 'T'); const h = f.filter((x) => x === 'H').length; return `🪙 [${f.join(' ')}] → **${h >= 2 ? 'Heads' : 'Tails'}** wins!`; } },

  // =================== THE 1,500 FINISH LINE ===================
  // ---- 📐 CONVERSIONS 6 ----
  CONV('kb2bit', 'KB', 'bit', (n) => n * 8192, '💾'), CONV('gb2byte', 'GB', 'B', (n) => n * 1073741824, '💾'),
  CONV('in2m', 'in', 'm', (n) => n * 0.0254, '📏'), CONV('m2fathom', 'm', 'fathom', (n) => n / 1.8288, '⚓'),
  CONV('l2tbsp', 'L', 'tbsp', (n) => n * 67.628, '🥄'), CONV('day2sec', 'day', 'sec', (n) => n * 86400, '⏱️'),
  CONV('yr2hr', 'yr', 'hr', (n) => n * 8760, '📅'), CONV('atm2mmhg', 'atm', 'mmHg', (n) => n * 760, '🎈'),
  CONV('psi2pa', 'psi', 'Pa', (n) => n * 6894.76, '🎈'), CONV('cal2wh', 'kcal', 'Wh', (n) => n * 1.16222, '🔋'),
  CONV('lb2n', 'lb-force', 'N', (n) => n * 4.44822, '💪'), CONV('n2lb', 'N', 'lb-force', (n) => n / 4.44822, '💪'),
  CONV('m2nmi', 'm', 'nmi', (n) => n / 1852, '⚓'), CONV('km2au', 'km', 'AU', (n) => n / 1.496e8, '🪐'),
  CONV('sqcm2sqmm', 'sq-cm', 'sq-mm', (n) => n * 100, '🟦'),

  // ---- 🧮 MATH 8 ----
  { name: 'clamp', category: 'qmath6', description: 'Clamp a value: ?clamp <value> <min> <max>', run: ({ argv }) => { const [v, lo, hi] = need2(argv, 3, '?clamp 15 0 10'); return `📏 = **${Math.max(lo, Math.min(hi, v))}**`; } },
  { name: 'lerp', category: 'qmath6', description: 'Linear interpolate: ?lerp <a> <b> <t 0-1>', run: ({ argv }) => { const [a, b, t] = need2(argv, 3, '?lerp 0 100 0.5'); return `📈 = **${round(a + (b - a) * t, 4)}**`; } },
  { name: 'maprange', category: 'qmath6', description: 'Remap: ?maprange <v> <inMin> <inMax> <outMin> <outMax>', run: ({ argv }) => { const [v, a, b, c, d] = need2(argv, 5, '?maprange 5 0 10 0 100'); if (b === a) throw new Error('in range is zero'); return `🔀 = **${round(c + (v - a) * (d - c) / (b - a), 4)}**`; } },
  { name: 'percentile', category: 'qmath6', description: 'Percentile of a list: ?percentile <p 0-100> <numbers…>', run: ({ argv }) => { const p = Number(argv[0]); const n = nums(argv.slice(1)).sort((a, b) => a - b); if (Number.isNaN(p) || n.length < 2) throw new Error('Usage: `?percentile 90 5 3 8 1 9`'); const i = p / 100 * (n.length - 1), lo = Math.floor(i); return `📊 P${p} = **${round(n[lo] + (i - lo) * (n[lo + 1] - n[lo]), 3)}**`; } },
  { name: 'roundto', category: 'qmath6', description: 'Round to decimals: ?roundto <n> <decimals>', run: ({ argv }) => { const [n, d = 2] = nums(argv); if (n == null) throw new Error('Usage: `?roundto 3.14159 2`'); return `🔢 = **${round(n, d)}**`; } },
  { name: 'sumto', category: 'qmath6', description: 'Sum 1..n (Gauss): ?sumto <n>', run: ({ argv }) => { const [n] = nums(argv); if (n == null || n < 0) throw new Error('Usage: `?sumto 100`'); return `➕ 1+…+${n} = **${n * (n + 1) / 2}**`; } },
  { name: 'gforce', category: 'qmath6', description: 'Acceleration in G: ?gforce <m/s²>', run: ({ argv }) => { const [a] = nums(argv); if (a == null) throw new Error('Usage: `?gforce 29.4`'); return `🎢 = **${round(a / 9.81, 3)} G**`; } },

  // ---- 🎁 GENERATORS 8 (qgen4) ----
  { name: 'crystal', category: 'qgen4', description: 'A random crystal', run: () => '🔮 ' + pick(['Rose Quartz', 'Obsidian', 'Citrine', 'Selenite', 'Labradorite', 'Fluorite', 'Moonstone', 'Tourmaline', 'Aventurine']) },
  { name: 'artifact', category: 'qgen4', description: 'A random magic artifact', run: () => '🗝️ ' + pick(['Amulet of', 'Ring of', 'Blade of', 'Tome of', 'Orb of']) + ' ' + pick(['Eternity', 'Shadows', 'the Phoenix', 'Whispers', 'the Void', 'Storms']) },
  { name: 'tavern', category: 'qgen4', description: 'A random tavern name', run: () => '🍺 The ' + pick(['Prancing', 'Rusty', 'Golden', 'Drunken', 'Salty', 'Sleeping']) + ' ' + pick(['Pony', 'Dragon', 'Anchor', 'Griffin', 'Barrel', 'Mermaid']) },
  { name: 'godname', category: 'qgen4', description: 'A random deity name', run: () => '⚡ ' + pick(['Zar', 'Vael', 'Thrymm', 'Nyx', 'Orin', 'Kaelis']) + ', god of ' + pick(['thunder', 'the deep', 'the harvest', 'war', 'dreams', 'the dawn']) },
  { name: 'starname', category: 'qgen4', description: 'A random star name', run: () => '⭐ ' + pick(['Altair', 'Vega', 'Rigel', 'Sirius', 'Antares', 'Betelgeuse', 'Polaris', 'Deneb', 'Arcturus', 'Capella']) },
  { name: 'nebula', category: 'qgen4', description: 'A random nebula', run: () => '🌌 ' + pick(['Orion', 'Crab', 'Eagle', 'Horsehead', 'Helix', 'Ring', 'Veil', 'Carina', 'Rosette']) + ' Nebula' },
  { name: 'spaceship', aliases: ['starship'], category: 'qgen4', description: 'A random starship name', run: () => '🚀 ' + pick(['SS', 'USS', 'ISV']) + ' ' + pick(['Odyssey', 'Nomad', 'Vanguard', 'Horizon', 'Peregrine', ' Empyrean'.trim(), 'Serenity']) },
  { name: 'blessing', category: 'qgen4', description: 'A random blessing', run: () => '✨ May you find ' + pick(['fortune', 'courage', 'wisdom', 'peace', 'strength', 'clarity']) + ' on your path.' },
  { name: 'curse', category: 'qgen4', description: 'A random (fun) curse', run: () => '🧿 May your ' + pick(['socks be forever damp', 'wifi buffer eternally', 'coffee always be lukewarm', 'shoelaces untie at noon']) + '.' },
  { name: 'omen', category: 'qgen4', description: 'A random omen', run: () => '🔮 ' + pick(['A red moon rises tonight.', 'Crows gather in threes.', 'The winds shift westward.', 'A star falls in the east.']) },
  { name: 'dragonname', category: 'qgen4', description: 'A random dragon name', run: () => '🐉 ' + pick(['Vermithrax', 'Pyraxis', 'Nocturne', 'Emberfang', 'Frostwing', 'Shadowscale', 'Goldscale', 'Stormrend']) },
  { name: 'cheese', category: 'qgen4', description: 'A random cheese', run: () => '🧀 ' + pick(['Cheddar', 'Brie', 'Gouda', 'Parmesan', 'Mozzarella', 'Blue', 'Feta', 'Camembert', 'Swiss', 'Manchego']) },
  { name: 'pizzatopping', category: 'qgen4', description: 'A random pizza topping', run: () => '🍕 ' + pick(['Pepperoni', 'Mushroom', 'Pineapple', 'Sausage', 'Olives', 'Bacon', 'Peppers', 'Onion', 'Extra Cheese']) },
  { name: 'randtongue', aliases: ['twister'], category: 'qgen4', description: 'A random tongue-twister', run: () => '👅 ' + pick(['She sells seashells by the seashore.', 'Peter Piper picked a peck of pickled peppers.', 'How much wood would a woodchuck chuck?', 'Red lorry, yellow lorry.']) },
  { name: 'randriddleq', aliases: ['brainteaser'], category: 'qgen4', description: 'A random brain teaser', run: () => { const r = pick([['I have cities but no houses. What am I?', 'A map'], ['The more you take, the more you leave behind. What am I?', 'Footsteps'], ['What has a neck but no head?', 'A bottle']]); return `🧩 ${r[0]}\n||${r[1]}||`; } },

  // ---- 😀 KAOMOJI 6 ----
  { name: 'happy6', category: 'qkao', description: '(⌒▽⌒)☆', run: () => '(⌒▽⌒)☆' },
  { name: 'lovehug', category: 'qkao', description: '(づ￣ ³￣)づ♡', run: () => '(づ￣ ³￣)づ♡' },
  { name: 'flexkao', category: 'qkao', description: 'ᕦ(ò_óˇ)ᕤ', run: () => 'ᕦ(ò_óˇ)ᕤ' },
  { name: 'sleepykao', category: 'qkao', description: '(∪｡∪)｡｡｡zzz', run: () => '(∪｡∪)｡｡｡zzz' },
  { name: 'angrykao', category: 'qkao', description: '(╬ Ò﹏Ó)', run: () => 'Σ(▼□▼メ)' },
  { name: 'cheerkao', category: 'qkao', description: '\\(^ω^\\)', run: () => '\\(^ω^\\)' },
  { name: 'wowkao', category: 'qkao', description: '(°o°)', run: () => '(°o°)' },
  { name: 'lovelykao', category: 'qkao', description: '(◕‿◕)♡', run: () => '(◕‿◕)♡' },
  { name: 'coolkao', category: 'qkao', description: '(▀̿Ĺ̯▀̿ ̿)', run: () => '(▀̿Ĺ̯▀̿ ̿)' },
  { name: 'crykao', category: 'qkao', description: 'ಥ_ಥ', run: () => 'ಥ_ಥ' },
  { name: 'shychar', category: 'qkao', description: '(⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)', run: () => '(⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)' },
  { name: 'runkao', category: 'qkao', description: 'ᕕ(⌐■_■)ᕗ ♪♬', run: () => 'ᕕ(⌐■_■)ᕗ ♪♬' },
  { name: 'thinkkao', category: 'qkao', description: '(￢‿￢ )', run: () => '(￢‿￢ )' },
  { name: 'partykao', category: 'qkao', description: '⌐╦╦═─', run: () => '୧(๑•̀ヮ•́)૭' },
  { name: 'magicwand', category: 'qkao', description: '(ﾉ>ω<)ﾉ :｡･:*:･ﾟ', run: () => '(ﾉ>ω<)ﾉ :｡･:*:･ﾟ’★,｡･:*:･ﾟ’☆' },
  { name: 'sadface2', category: 'qkao', description: '(个_个)', run: () => '(个_个)' },
  { name: 'lovepunch', category: 'qkao', description: '♡(˃͈ દ ˂͈ ༶ )', run: () => '♡(˃͈ દ ˂͈ ༶ )' },
  { name: 'yeah', category: 'qkao', description: '(๑•̀ㅂ•́)و✧', run: () => '(๑•̀ㅂ•́)و✧' },
  { name: 'nomnom', category: 'qkao', description: '( ˘▽˘)っ🍕', run: () => '( ˘▽˘)っ🍕' },
  { name: 'wizkao', category: 'qkao', description: '(∩ ͡° ͜ʖ ͡°)⊃━☆ﾟ', run: () => '(∩ ͡° ͜ʖ ͡°)⊃━☆ﾟ' },
  { name: 'lottery', aliases: ['lotto'], category: 'qcasino', description: 'Server lottery — ?lottery buy <n> to enter the growing pot', run: ({ message, args }) => {
    if (!message.guild) return 'Use this in a server.';
    return casinoOff(message) || renderLottery(message.guild.id, message.author.id, message.member?.displayName || message.author.username, args);
  } },
  { name: 'heist', aliases: ['robbank'], category: 'qcasino', description: 'Start or join a live crew heist — ?heist [buy-in]', run: ({ message, args }) => {
    if (!message.guild) return 'Use this in a server.';
    const off = casinoOff(message); if (off) return off;
    return heistCommand({
      guildId: message.guild.id, channelId: message.channel.id, channel: message.channel,
      userId: message.author.id, name: message.member?.displayName || message.author.username, arg: args,
    });
  } },

  // ---------------- MATH & CONVERT (category: qmath) ----------------
  { name: 'calc', aliases: ['math'], category: 'qmath', description: 'Evaluate a math expression', run: ({ args }) => { const e = need(args, '?calc <expression>'); if (!/^[-+*/%.()\d\s]+$/.test(e)) throw new Error('Only numbers and + - * / % ( ) allowed.'); const r = Function(`"use strict";return (${e})`)(); return `🧮 ${e} = **${r}**`; } },
  { name: 'roll', aliases: ['dice'], category: 'qmath', description: 'Roll dice, e.g. ?roll 2d6', run: ({ args }) => { const m = (args || '1d6').trim().match(/^(\d*)d(\d+)$/i); if (!m) throw new Error('Format: `?roll 2d6`'); const n = Math.min(100, +(m[1] || 1)); const s = Math.min(1000, +m[2]); const rolls = Array.from({ length: n }, () => rint(1, s)); return `🎲 [${rolls.join(', ')}] = **${rolls.reduce((a, b) => a + b, 0)}**`; } },
  { name: 'percent', aliases: ['pct'], category: 'qmath', description: '?percent 20 150 → 20% of 150', run: ({ argv }) => { const [p, v] = nums(argv); if (p == null || v == null) throw new Error('Usage: `?percent <pct> <value>`'); return `📈 ${p}% of ${v} = **${(p / 100) * v}**`; } },
  { name: 'sum', aliases: ['add'], category: 'qmath', description: 'Sum a list of numbers', run: ({ argv }) => { const n = nums(argv); if (!n.length) throw new Error('Usage: `?sum 1 2 3`'); return `➕ Sum = **${n.reduce((a, b) => a + b, 0)}**`; } },
  { name: 'avg', aliases: ['mean', 'average'], category: 'qmath', description: 'Average a list of numbers', run: ({ argv }) => { const n = nums(argv); if (!n.length) throw new Error('Usage: `?avg 1 2 3`'); return `📊 Average = **${(n.reduce((a, b) => a + b, 0) / n.length).toFixed(2)}**`; } },
  { name: 'c2f', category: 'qmath', description: 'Celsius → Fahrenheit', run: ({ argv }) => { const [c] = nums(argv); if (c == null) throw new Error('Usage: `?c2f 20`'); return `🌡️ ${c}°C = **${(c * 9 / 5 + 32).toFixed(1)}°F**`; } },
  { name: 'f2c', category: 'qmath', description: 'Fahrenheit → Celsius', run: ({ argv }) => { const [f] = nums(argv); if (f == null) throw new Error('Usage: `?f2c 68`'); return `🌡️ ${f}°F = **${((f - 32) * 5 / 9).toFixed(1)}°C**`; } },
  { name: 'mi2km', category: 'qmath', description: 'Miles → kilometers', run: ({ argv }) => { const [m] = nums(argv); if (m == null) throw new Error('Usage: `?mi2km 5`'); return `📏 ${m} mi = **${(m * 1.60934).toFixed(2)} km**`; } },
  { name: 'km2mi', category: 'qmath', description: 'Kilometers → miles', run: ({ argv }) => { const [k] = nums(argv); if (k == null) throw new Error('Usage: `?km2mi 5`'); return `📏 ${k} km = **${(k / 1.60934).toFixed(2)} mi**`; } },
  { name: 'kg2lb', category: 'qmath', description: 'Kilograms → pounds', run: ({ argv }) => { const [k] = nums(argv); if (k == null) throw new Error('Usage: `?kg2lb 70`'); return `⚖️ ${k} kg = **${(k * 2.20462).toFixed(1)} lb**`; } },
  { name: 'lb2kg', category: 'qmath', description: 'Pounds → kilograms', run: ({ argv }) => { const [l] = nums(argv); if (l == null) throw new Error('Usage: `?lb2kg 150`'); return `⚖️ ${l} lb = **${(l / 2.20462).toFixed(1)} kg**`; } },
  { name: 'roman', category: 'qmath', description: 'Number → Roman numerals', run: ({ argv }) => { let n = nums(argv)[0]; if (n == null || n < 1 || n > 3999) throw new Error('Give 1–3999.'); let out = ''; for (const [v, s] of ROMANS) while (n >= v) { out += s; n -= v; } return `🏛️ **${out}**`; } },
  { name: 'unroman', category: 'qmath', description: 'Roman numerals → number', run: ({ args }) => { const s = need(args, '?unroman <numeral>').toUpperCase(); const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }; let t = 0; for (let i = 0; i < s.length; i++) { const c = map[s[i]]; if (!c) throw new Error('Invalid numeral.'); t += c < map[s[i + 1]] ? -c : c; } return `🔢 **${t}**`; } },
  { name: 'factorial', aliases: ['fact!'], category: 'qmath', description: 'n! factorial', run: ({ argv }) => { const n = nums(argv)[0]; if (n == null || n < 0 || n > 170) throw new Error('Give 0–170.'); let r = 1; for (let i = 2; i <= n; i++) r *= i; return `❗ ${n}! = **${r}**`; } },
  { name: 'isprime', category: 'qmath', description: 'Is a number prime?', run: ({ argv }) => { const n = nums(argv)[0]; if (n == null || n < 1) throw new Error('Give a positive integer.'); let p = n > 1; for (let i = 2; i * i <= n; i++) if (n % i === 0) { p = false; break; } return `${p ? '✅' : '❌'} ${n} is ${p ? '' : 'not '}prime.`; } },
  { name: 'fib', category: 'qmath', description: 'Nth Fibonacci number', run: ({ argv }) => { const n = nums(argv)[0]; if (n == null || n < 0 || n > 90) throw new Error('Give 0–90.'); let [a, b] = [0, 1]; for (let i = 0; i < n; i++) [a, b] = [b, a + b]; return `🔢 fib(${n}) = **${a}**`; } },
  { name: 'gcd', category: 'qmath', description: 'Greatest common divisor', run: ({ argv }) => { let [a, b] = nums(argv); if (a == null || b == null) throw new Error('Usage: `?gcd 12 18`'); [a, b] = [Math.abs(a), Math.abs(b)]; while (b) [a, b] = [b, a % b]; return `🔗 GCD = **${a}**`; } },
  { name: 'hex', category: 'qmath', description: 'Decimal → hexadecimal', run: ({ argv }) => { const n = nums(argv)[0]; if (n == null) throw new Error('Usage: `?hex 255`'); return `🔟 ${n} = **0x${n.toString(16).toUpperCase()}**`; } },
  { name: 'unhex', category: 'qmath', description: 'Hexadecimal → decimal', run: ({ args }) => { const s = need(args, '?unhex <hex>').replace(/^0x/i, ''); const n = parseInt(s, 16); if (Number.isNaN(n)) throw new Error('Bad hex.'); return `🔟 0x${s.toUpperCase()} = **${n}**`; } },
  { name: 'dec2bin', category: 'qmath', description: 'Decimal → binary', run: ({ argv }) => { const n = nums(argv)[0]; if (n == null) throw new Error('Usage: `?dec2bin 10`'); return `💾 ${n} = **${n.toString(2)}**`; } },
  { name: 'bin2dec', category: 'qmath', description: 'Binary → decimal', run: ({ args }) => { const s = need(args, '?bin2dec <bits>'); const n = parseInt(s, 2); if (Number.isNaN(n)) throw new Error('Bad binary.'); return `💾 ${s} = **${n}**`; } },
  { name: 'tip', category: 'qmath', description: '?tip 50 18 → tip on a bill', run: ({ argv }) => { const [bill, p = 15] = nums(argv); if (bill == null) throw new Error('Usage: `?tip <bill> [pct]`'); const t = bill * p / 100; return `💵 ${p}% tip on ${bill} = **${t.toFixed(2)}** (total **${(bill + t).toFixed(2)}**)`; } },

  // ---------------- FUN (category: qfun) ----------------
  { name: '8ball', aliases: ['8b'], category: 'qfun', description: 'Ask the magic 8-ball', run: ({ args }) => { need(args, '?8ball <question>'); return `🎱 ${pick(['It is certain.', 'Without a doubt.', 'Yes — definitely.', 'Most likely.', 'Ask again later.', 'Cannot predict now.', "Don't count on it.", 'My reply is no.', 'Very doubtful.', 'Outlook not so good.'])}`; } },
  { name: 'coin', aliases: ['flip', 'coinflip'], category: 'qfun', description: 'Flip a coin', run: () => `🪙 **${pick(['Heads', 'Tails'])}**!` },
  { name: 'choose', aliases: ['pick'], category: 'qfun', description: 'Pick from options (comma-separated)', run: ({ args }) => { const opts = need(args, '?choose a, b, c').split(',').map((s) => s.trim()).filter(Boolean); if (opts.length < 2) throw new Error('Give at least 2 options separated by commas.'); return `🤔 I choose **${pick(opts)}**!`; } },
  { name: 'rps', category: 'qfun', description: 'Rock–paper–scissors vs the bot', run: ({ argv }) => { const you = (argv[0] || '').toLowerCase(); const set = ['rock', 'paper', 'scissors']; if (!set.includes(you)) throw new Error('Pick rock, paper, or scissors.'); const me = pick(set); const win = { rock: 'scissors', paper: 'rock', scissors: 'paper' }; const res = you === me ? "It's a tie!" : win[you] === me ? 'You win! 🎉' : 'I win! 😎'; return `You: ${you} • Me: ${me} → **${res}**`; } },
  { name: 'ship', category: 'qfun', description: '?ship A B → love calculator', run: ({ argv }) => { if (argv.length < 2) throw new Error('Usage: `?ship <a> <b>`'); const seed = [...argv.join('')].reduce((a, c) => a + c.charCodeAt(0), 0); const pctv = seed % 101; return `💘 **${argv[0]} + ${argv[1]}** = ${pctv}% ${pctv > 70 ? '❤️' : pctv > 40 ? '💛' : '💔'}`; } },
  { name: 'rate', category: 'qfun', description: 'Rate anything out of 10', run: ({ args }) => { const s = need(args, '?rate <thing>'); const seed = [...s].reduce((a, c) => a + c.charCodeAt(0), 0); return `⭐ I rate **${s}** a **${seed % 11}/10**.`; } },
  { name: 'iq', category: 'qfun', description: 'Measure someone’s "IQ"', run: ({ args, message }) => `🧠 ${args || message.author.username} has an IQ of **${rint(55, 160)}**.` },
  { name: 'simp', aliases: ['howsimp'], category: 'qfun', description: 'Simp meter', run: ({ args, message }) => `😳 ${args || message.author.username} is **${rint(0, 100)}%** simp.` },
  { name: 'vibe', category: 'qfun', description: 'Vibe check', run: ({ message }) => `${pick(['✅ Vibe check passed!', '❌ Vibe check FAILED.', '🌊 Immaculate vibes.', '😐 Mid vibes, honestly.'])} — ${message.author.username}` },
  { name: 'decide', aliases: ['yn'], category: 'qfun', description: 'Yes or no?', run: () => pick(['✅ Yes.', '❌ No.', '🤷 Maybe.', '💯 Absolutely.', '🚫 Absolutely not.']) },
  { name: 'roast', category: 'qfun', description: 'Get a light-hearted roast', run: ({ args, message }) => `🔥 ${args || message.author.username}, ${pick(['you bring everyone so much joy… when you leave the room.', 'your secrets are safe with me — I never even listen.', "you have something on your chin… no, the third one down.", "if laughter is the best medicine, your face is curing the whole server.", "you're not stupid; you just have bad luck thinking."])}` },
  { name: 'compliment', aliases: ['nice'], category: 'qfun', description: 'Get a wholesome compliment', run: ({ args, message }) => `💖 ${args || message.author.username}, ${pick(['you light up every channel you post in.', 'your energy is genuinely contagious.', "you're the reason this server smiles.", 'you make hard things look easy.', 'the world is better with you in it.'])}` },
  { name: 'pickup', aliases: ['rizz'], category: 'qfun', description: 'A cheesy pickup line', run: () => `😏 ${pick(['Are you a magician? Because whenever I look at you, everyone else disappears.', "Do you have a map? I keep getting lost in your eyes.", 'Are you Wi-Fi? Because I’m feeling a connection.', "If you were a vegetable you'd be a cute-cumber.", 'Are you made of copper and tellurium? Because you’re Cu-Te.'])}` },
  { name: 'wyr', aliases: ['wouldyourather'], category: 'qfun', description: 'Would you rather…?', run: () => `🤔 Would you rather ${pick(['be able to fly', 'be invisible', 'read minds', 'never sleep again', 'have unlimited money', 'live forever', 'teleport anywhere', 'speak every language'])} **OR** ${pick(['breathe underwater', 'stop time', 'be super strong', 'never eat again', 'know every truth', 'be famous', 'time travel', 'talk to animals'])}?` },
  { name: 'fortune', aliases: ['cookie'], category: 'qfun', description: 'Crack a fortune cookie', run: () => `🥠 ${pick(['A pleasant surprise is waiting for you.', 'Your hard work is about to pay off.', 'Adventure awaits — say yes.', 'The best is yet to come.', 'A small act of kindness will echo far.', 'Good news will come from far away.'])}` },
  { name: 'dadjoke', aliases: ['dad'], category: 'qfun', description: 'A groan-worthy dad joke', run: () => pick(['I’m afraid for the calendar. Its days are numbered.', 'Why don’t skeletons fight each other? They don’t have the guts.', 'I only know 25 letters of the alphabet. I don’t know y.', 'What do you call fake spaghetti? An impasta.', 'I used to hate facial hair… but then it grew on me.']) },
  { name: 'fact', aliases: ['randomfact'], category: 'qfun', description: 'A random fun fact', run: () => `💡 ${pick(['Honey never spoils.', 'Octopuses have three hearts.', 'Bananas are berries; strawberries aren’t.', 'A day on Venus is longer than its year.', 'Wombat poop is cube-shaped.', 'Sharks existed before trees.'])}` },
  { name: 'cowsay', category: 'qfun', description: 'Have a cow say your text', run: ({ args }) => { const t = need(args, '?cowsay <text>').slice(0, 120); const cow = ['        \\   ^__^', '         \\  (oo)\\_______', '            (__)\\       )\\/\\', '                ||----w |', '                ||     ||'].join('\n'); return '```\n ' + '_'.repeat(t.length + 2) + '\n< ' + t + ' >\n ' + '-'.repeat(t.length + 2) + '\n' + cow + '\n```'; } },
  { name: 'slot', aliases: ['slots'], category: 'qfun', description: 'Spin a mini slot machine', run: () => { const e = ['🍒', '🍋', '🔔', '💎', '7️⃣', '🍀']; const r = [pick(e), pick(e), pick(e)]; const win = r[0] === r[1] && r[1] === r[2]; return `🎰 [ ${r.join(' | ')} ] ${win ? '— **JACKPOT!** 🎉' : ''}`; } },

  // ---------------- UTILITY (category: qutil) ----------------
  { name: 'uuid', aliases: ['guid'], category: 'qutil', description: 'Generate a random UUID', run: () => `🆔 \`${globalThis.crypto.randomUUID()}\`` },
  { name: 'password', aliases: ['pw', 'pass'], category: 'qutil', description: 'Generate a strong password', run: ({ argv }) => { const len = Math.min(64, Math.max(6, nums(argv)[0] || 16)); const cs = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*'; let p = ''; for (let i = 0; i < len; i++) p += cs[Math.floor(Math.random() * cs.length)]; return `🔐 ||\`${p}\`||`; } },
  { name: 'color', aliases: ['hexcolor'], category: 'qutil', description: 'Random hex color', run: () => { const h = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0').toUpperCase(); return `🎨 \`${h}\``; } },
  { name: 'random', aliases: ['rng', 'rand'], category: 'qutil', description: 'Random number ?random 1 100', run: ({ argv }) => { const [a = 1, b = 100] = nums(argv); return `🎲 **${rint(Math.min(a, b), Math.max(a, b))}**`; } },
  { name: 'len', aliases: ['length'], category: 'qutil', description: 'Length of your text', run: ({ args }) => `📏 **${[...need(args, '?len <text>')].length}** characters.` },
  { name: 'ascii', category: 'qutil', description: 'Text → ASCII codes', run: ({ args }) => [...need(args, '?ascii <text>')].map((c) => c.charCodeAt(0)).join(' ') },
  { name: 'base64', aliases: ['b64', 'encode'], category: 'qutil', description: 'Encode text to Base64', run: ({ args }) => Buffer.from(need(args, '?base64 <text>')).toString('base64') },
  { name: 'unbase64', aliases: ['unb64', 'decode'], category: 'qutil', description: 'Decode Base64 to text', run: ({ args }) => Buffer.from(need(args, '?unbase64 <b64>'), 'base64').toString('utf8') },
  { name: 'ping', category: 'qutil', description: 'Show the bot’s gateway latency', run: ({ message }) => `🏓 Pong! Gateway ping: **${Math.round(message.client.ws.ping)}ms**` },
  { name: 'urlencode', aliases: ['urlenc'], category: 'qutil', description: 'Percent-encode text for URLs', run: ({ args }) => encodeURIComponent(need(args, '?urlencode <text>')) },
  { name: 'urldecode', aliases: ['urldec'], category: 'qutil', description: 'Decode a percent-encoded URL', run: ({ args }) => decodeURIComponent(need(args, '?urldecode <text>')) },

  // ---------------- added batch: more distinct text / math / util / fun ----------------
  { name: 'snake', category: 'qtext', description: 'text → snake_case', run: ({ args }) => need(args, '?snake <text>').replace(/[^a-zA-Z0-9]+/g, ' ').trim().replace(/\s+/g, '_').toLowerCase() },
  { name: 'kebab', category: 'qtext', description: 'text → kebab-case', run: ({ args }) => need(args, '?kebab <text>').replace(/[^a-zA-Z0-9]+/g, ' ').trim().replace(/\s+/g, '-').toLowerCase() },
  { name: 'camel', category: 'qtext', description: 'text → camelCase', run: ({ args }) => need(args, '?camel <text>').replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(/\s+/).map((x, i) => i ? x[0].toUpperCase() + x.slice(1).toLowerCase() : x.toLowerCase()).join('') },
  { name: 'pascal', category: 'qtext', description: 'text → PascalCase', run: ({ args }) => need(args, '?pascal <text>').replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(/\s+/).map((x) => x[0].toUpperCase() + x.slice(1).toLowerCase()).join('') },
  { name: 'slugify', aliases: ['slug'], category: 'qtext', description: 'Make a URL slug', run: ({ args }) => need(args, '?slugify <text>').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') },
  { name: 'caesar', category: 'qtext', description: '?caesar <shift> <text> — Caesar cipher', run: ({ argv }) => { const n = (((parseInt(argv[0], 10) || 0) % 26) + 26) % 26; const t = argv.slice(1).join(' '); if (!t) throw new Error('Usage: `?caesar <shift> <text>`'); return t.replace(/[a-z]/gi, (c) => { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode(((c.charCodeAt(0) - b + n) % 26) + b); }); } },
  { name: 'atbash', category: 'qtext', description: 'Atbash cipher (a↔z)', run: ({ args }) => need(args, '?atbash <text>').replace(/[a-z]/gi, (c) => { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode(b + 25 - (c.charCodeAt(0) - b)); }) },
  { name: 'nato', category: 'qtext', description: 'Spell with the NATO alphabet', run: ({ args }) => { const N = { a: 'Alfa', b: 'Bravo', c: 'Charlie', d: 'Delta', e: 'Echo', f: 'Foxtrot', g: 'Golf', h: 'Hotel', i: 'India', j: 'Juliett', k: 'Kilo', l: 'Lima', m: 'Mike', n: 'November', o: 'Oscar', p: 'Papa', q: 'Quebec', r: 'Romeo', s: 'Sierra', t: 'Tango', u: 'Uniform', v: 'Victor', w: 'Whiskey', x: 'X-ray', y: 'Yankee', z: 'Zulu' }; return [...need(args, '?nato <text>').toLowerCase()].map((c) => N[c] || c).join(' '); } },
  { name: 'piglatin', aliases: ['pig'], category: 'qtext', description: 'Translate to Pig Latin', run: ({ args }) => need(args, '?piglatin <text>').split(/\s+/).map((w) => { const m = w.match(/^([^aeiou]+)(.*)$/i); return m && m[2] ? m[2] + m[1] + 'ay' : w + 'way'; }).join(' ') },
  { name: 'upsidedown', aliases: ['fliptext'], category: 'qtext', description: 'Flip text upside-down', run: ({ args }) => { const F = { a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ᴉ', j: 'ɾ', k: 'ʞ', l: 'l', m: 'ɯ', n: 'u', o: 'o', p: 'd', q: 'b', r: 'ɹ', s: 's', t: 'ʇ', u: 'n', v: 'ʌ', w: 'ʍ', x: 'x', y: 'ʎ', z: 'z', '?': '¿', '.': '˙', '!': '¡' }; return [...need(args, '?upsidedown <text>').toLowerCase()].reverse().map((c) => F[c] || c).join(''); } },
  { name: 'bytes', category: 'qutil', description: 'Byte length of text (UTF-8)', run: ({ args }) => `📏 **${Buffer.byteLength(need(args, '?bytes <text>'), 'utf8')}** bytes` },
  { name: 'hexencode', aliases: ['tohex'], category: 'qutil', description: 'Text → hex bytes', run: ({ args }) => Buffer.from(need(args, '?hexencode <text>'), 'utf8').toString('hex') },
  { name: 'hexdecode', aliases: ['fromhex'], category: 'qutil', description: 'Hex bytes → text', run: ({ args }) => { try { return Buffer.from(need(args, '?hexdecode <hex>').replace(/\s+/g, ''), 'hex').toString('utf8'); } catch { throw new Error('Bad hex.'); } } },
  { name: 'sha256', category: 'qutil', description: 'SHA-256 hash of text', run: ({ args }) => createHash('sha256').update(need(args, '?sha256 <text>')).digest('hex') },
  { name: 'md5', category: 'qutil', description: 'MD5 hash of text', run: ({ args }) => createHash('md5').update(need(args, '?md5 <text>')).digest('hex') },
  { name: 'lcm', category: 'qmath', description: 'Least common multiple', run: ({ argv }) => { let [a, b] = nums(argv); if (a == null || b == null) throw new Error('Usage: `?lcm 4 6`'); a = Math.abs(a); b = Math.abs(b); const g = (x, y) => { while (y) { [x, y] = [y, x % y]; } return x; }; return `🔗 LCM = **${(a / g(a, b)) * b}**`; } },
  { name: 'sqrt', category: 'qmath', description: 'Square root', run: ({ argv }) => { const n = nums(argv)[0]; if (n == null || n < 0) throw new Error('Give a number ≥ 0.'); return `√${n} = **${Math.sqrt(n)}**`; } },
  { name: 'pow', category: 'qmath', description: '?pow <base> <exp>', run: ({ argv }) => { const [a, b] = nums(argv); if (a == null || b == null) throw new Error('Usage: `?pow 2 10`'); return `${a}^${b} = **${Math.pow(a, b)}**`; } },
  { name: 'hypot', category: 'qmath', description: 'Hypotenuse √(a²+b²)', run: ({ argv }) => { const [a, b] = nums(argv); if (a == null || b == null) throw new Error('Usage: `?hypot 3 4`'); return `📐 **${Math.hypot(a, b)}**`; } },
  { name: 'deg2rad', category: 'qmath', description: 'Degrees → radians', run: ({ argv }) => { const d = nums(argv)[0]; if (d == null) throw new Error('Usage: `?deg2rad 90`'); return `${d}° = **${((d * Math.PI) / 180).toFixed(4)} rad**`; } },
  { name: 'rad2deg', category: 'qmath', description: 'Radians → degrees', run: ({ argv }) => { const r = nums(argv)[0]; if (r == null) throw new Error('Usage: `?rad2deg 1.5708`'); return `${r} rad = **${((r * 180) / Math.PI).toFixed(2)}°**`; } },
  { name: 'ft2m', category: 'qmath', description: 'Feet → meters', run: ({ argv }) => { const f = nums(argv)[0]; if (f == null) throw new Error('Usage: `?ft2m 6`'); return `📏 ${f} ft = **${(f * 0.3048).toFixed(2)} m**`; } },
  { name: 'm2ft', category: 'qmath', description: 'Meters → feet', run: ({ argv }) => { const m = nums(argv)[0]; if (m == null) throw new Error('Usage: `?m2ft 2`'); return `📏 ${m} m = **${(m / 0.3048).toFixed(2)} ft**`; } },
  { name: 'bmi', category: 'qmath', description: '?bmi <kg> <m> — body mass index', run: ({ argv }) => { const [w, h] = nums(argv); if (w == null || h == null || h <= 0) throw new Error('Usage: `?bmi <kg> <height m>`'); return `⚖️ BMI = **${(w / (h * h)).toFixed(1)}**`; } },
  { name: 'digitsum', category: 'qmath', description: 'Sum of a number’s digits', run: ({ argv }) => { const n = argv[0]; if (!/^\d+$/.test(n || '')) throw new Error('Usage: `?digitsum 12345`'); return `➕ **${[...n].reduce((a, d) => a + +d, 0)}**`; } },
  { name: 'collatz', category: 'qmath', description: 'Collatz steps to reach 1', run: ({ argv }) => { let n = nums(argv)[0]; if (n == null || n < 1 || n > 1e7) throw new Error('Give 1–10,000,000.'); let s = 0; while (n !== 1) { n = n % 2 ? 3 * n + 1 : n / 2; s++; } return `🌀 **${s}** steps`; } },
  { name: 'primefactors', aliases: ['factorize'], category: 'qmath', description: 'Prime factorization', run: ({ argv }) => { let n = nums(argv)[0]; if (n == null || n < 2 || n > 1e12) throw new Error('Give 2–1e12.'); const f = []; for (let d = 2; d * d <= n; d++) while (n % d === 0) { f.push(d); n /= d; } if (n > 1) f.push(n); return `🔢 ${f.join(' × ')}`; } },
  { name: 'motivate', aliases: ['motivation'], category: 'qfun', description: 'A motivational line', run: () => `💪 ${pick(['You’ve survived 100% of your worst days.', 'Small progress is still progress.', 'Discipline beats motivation — start anyway.', 'The work you avoid is the work that grows you.', 'Future-you is begging you to start now.'])}` },
  { name: 'advice', category: 'qfun', description: 'A bit of advice', run: () => `🧠 ${pick(['Drink some water. Seriously.', 'Sleep on big decisions.', 'Do the 2-minute task now.', 'Back up your work. (You know who you are.)', 'Touch grass, then touch code.'])}` },

  // ============ v2 batch — real, distinct commands (toward 500) ============
  // ---- more math ----
  { name: 'median', category: 'qmath', description: 'Median of numbers', run: ({ argv }) => { const n = nums(argv).sort((a, b) => a - b); if (!n.length) throw new Error('Usage: ?median 1 2 3'); const m = Math.floor(n.length / 2); return String(n.length % 2 ? n[m] : (n[m - 1] + n[m]) / 2); } },
  { name: 'mode', category: 'qmath', description: 'Most frequent number', run: ({ argv }) => { const n = nums(argv); if (!n.length) throw new Error('Usage: ?mode 1 1 2'); const c = {}; let best = n[0]; for (const x of n) { c[x] = (c[x] || 0) + 1; if (c[x] > c[best]) best = x; } return String(best); } },
  { name: 'range', category: 'qmath', description: 'Max − min', run: ({ argv }) => { const n = nums(argv); if (!n.length) throw new Error('Usage: ?range 3 7 1'); return String(Math.max(...n) - Math.min(...n)); } },
  { name: 'min', category: 'qmath', description: 'Smallest number', run: ({ argv }) => { const n = nums(argv); if (!n.length) throw new Error('Usage: ?min 3 7 1'); return String(Math.min(...n)); } },
  { name: 'max', category: 'qmath', description: 'Largest number', run: ({ argv }) => { const n = nums(argv); if (!n.length) throw new Error('Usage: ?max 3 7 1'); return String(Math.max(...n)); } },
  { name: 'product', aliases: ['prod'], category: 'qmath', description: 'Multiply numbers', run: ({ argv }) => { const n = nums(argv); if (!n.length) throw new Error('Usage: ?product 2 3 4'); return String(n.reduce((a, b) => a * b, 1)); } },
  { name: 'stdev', category: 'qmath', description: 'Standard deviation', run: ({ argv }) => { const n = nums(argv); if (n.length < 2) throw new Error('Usage: ?stdev 2 4 6'); const m = n.reduce((a, b) => a + b) / n.length; return Math.sqrt(n.reduce((a, b) => a + (b - m) ** 2, 0) / n.length).toFixed(4); } },
  { name: 'abs', category: 'qmath', description: 'Absolute value', run: ({ argv }) => String(Math.abs(Number(need(argv[0], '?abs -5')))) },
  { name: 'round', category: 'qmath', description: 'Round to nearest integer', run: ({ argv }) => String(Math.round(Number(need(argv[0], '?round 3.6')))) },
  { name: 'floor', category: 'qmath', description: 'Round down', run: ({ argv }) => String(Math.floor(Number(need(argv[0], '?floor 3.6')))) },
  { name: 'ceil', category: 'qmath', description: 'Round up', run: ({ argv }) => String(Math.ceil(Number(need(argv[0], '?ceil 3.2')))) },
  { name: 'mod', category: 'qmath', description: 'Modulo (a mod b)', run: ({ argv }) => { const a = Number(argv[0]); const b = Number(argv[1]); if ([a, b].some(Number.isNaN) || b === 0) throw new Error('Usage: ?mod 17 5'); return String(((a % b) + b) % b); } },
  { name: 'square', aliases: ['sq'], category: 'qmath', description: 'Square a number', run: ({ argv }) => String(Number(need(argv[0], '?square 7')) ** 2) },
  { name: 'cube', category: 'qmath', description: 'Cube a number', run: ({ argv }) => String(Number(need(argv[0], '?cube 3')) ** 3) },
  { name: 'log', category: 'qmath', description: 'Base-10 logarithm', run: ({ argv }) => String(Math.log10(Number(need(argv[0], '?log 1000')))) },
  { name: 'ln', category: 'qmath', description: 'Natural logarithm', run: ({ argv }) => String(Math.log(Number(need(argv[0], '?ln 2.718')))) },
  { name: 'log2', category: 'qmath', description: 'Base-2 logarithm', run: ({ argv }) => String(Math.log2(Number(need(argv[0], '?log2 256')))) },
  { name: 'sin', category: 'qmath', description: 'Sine (degrees)', run: ({ argv }) => Math.sin(Number(need(argv[0], '?sin 30')) * Math.PI / 180).toFixed(6) },
  { name: 'cos', category: 'qmath', description: 'Cosine (degrees)', run: ({ argv }) => Math.cos(Number(need(argv[0], '?cos 60')) * Math.PI / 180).toFixed(6) },
  { name: 'tan', category: 'qmath', description: 'Tangent (degrees)', run: ({ argv }) => Math.tan(Number(need(argv[0], '?tan 45')) * Math.PI / 180).toFixed(6) },
  { name: 'ncr', category: 'qmath', description: 'Combinations nCr', run: ({ argv }) => { const n = +argv[0]; const r = +argv[1]; if ([n, r].some(Number.isNaN)) throw new Error('Usage: ?ncr 5 2'); const f = (x) => { let p = 1; for (let i = 2; i <= x; i++) p *= i; return p; }; return String(Math.round(f(n) / (f(r) * f(n - r)))); } },
  { name: 'npr', category: 'qmath', description: 'Permutations nPr', run: ({ argv }) => { const n = +argv[0]; const r = +argv[1]; if ([n, r].some(Number.isNaN)) throw new Error('Usage: ?npr 5 2'); const f = (x) => { let p = 1; for (let i = 2; i <= x; i++) p *= i; return p; }; return String(Math.round(f(n) / f(n - r))); } },
  { name: 'iseven', category: 'qmath', description: 'Is a number even?', run: ({ argv }) => (Number(need(argv[0], '?iseven 4')) % 2 === 0 ? '✅ even' : '❌ odd') },
  { name: 'isodd', category: 'qmath', description: 'Is a number odd?', run: ({ argv }) => (Math.abs(Number(need(argv[0], '?isodd 3')) % 2) === 1 ? '✅ odd' : '❌ even') },
  { name: 'digitalroot', aliases: ['droot'], category: 'qmath', description: 'Repeated digit sum', run: ({ argv }) => { let n = Math.abs(parseInt(need(argv[0], '?digitalroot 12345'), 10)); while (n >= 10) n = String(n).split('').reduce((a, d) => a + +d, 0); return String(n); } },
  { name: 'quadratic', aliases: ['quad'], category: 'qmath', description: 'Solve ax²+bx+c=0', run: ({ argv }) => { const [a, b, c] = nums(argv); if ([a, b, c].some((v) => v === undefined)) throw new Error('Usage: ?quadratic 1 -3 2'); const d = b * b - 4 * a * c; if (d < 0) return `No real roots (discriminant ${d})`; const s = Math.sqrt(d); return `x = ${(-b + s) / (2 * a)} or ${(-b - s) / (2 * a)}`; } },
  { name: 'dec2hex', category: 'qmath', description: 'Decimal → hex', run: ({ argv }) => '0x' + (parseInt(need(argv[0], '?dec2hex 255'), 10) >>> 0).toString(16) },
  { name: 'hex2dec', category: 'qmath', description: 'Hex → decimal', run: ({ argv }) => String(parseInt(need(argv[0], '?hex2dec ff').replace(/^0x/i, ''), 16)) },
  { name: 'oct', category: 'qmath', description: 'Decimal → octal', run: ({ argv }) => parseInt(need(argv[0], '?oct 64'), 10).toString(8) },
  // ---- unit conversions ----
  { name: 'c2k', category: 'qmath', description: 'Celsius → Kelvin', run: ({ argv }) => (Number(need(argv[0], '?c2k 25')) + 273.15).toFixed(2) + ' K' },
  { name: 'k2c', category: 'qmath', description: 'Kelvin → Celsius', run: ({ argv }) => (Number(need(argv[0], '?k2c 300')) - 273.15).toFixed(2) + ' °C' },
  { name: 'mph2kmh', category: 'qmath', description: 'mph → km/h', run: ({ argv }) => (Number(need(argv[0], '?mph2kmh 60')) * 1.609344).toFixed(2) + ' km/h' },
  { name: 'kmh2mph', category: 'qmath', description: 'km/h → mph', run: ({ argv }) => (Number(need(argv[0], '?kmh2mph 100')) / 1.609344).toFixed(2) + ' mph' },
  { name: 'in2cm', category: 'qmath', description: 'Inches → cm', run: ({ argv }) => (Number(need(argv[0], '?in2cm 12')) * 2.54).toFixed(2) + ' cm' },
  { name: 'cm2in', category: 'qmath', description: 'cm → inches', run: ({ argv }) => (Number(need(argv[0], '?cm2in 30')) / 2.54).toFixed(2) + ' in' },
  { name: 'oz2g', category: 'qmath', description: 'Ounces → grams', run: ({ argv }) => (Number(need(argv[0], '?oz2g 5')) * 28.3495).toFixed(2) + ' g' },
  { name: 'g2oz', category: 'qmath', description: 'Grams → ounces', run: ({ argv }) => (Number(need(argv[0], '?g2oz 100')) / 28.3495).toFixed(2) + ' oz' },
  { name: 'l2gal', category: 'qmath', description: 'Liters → US gallons', run: ({ argv }) => (Number(need(argv[0], '?l2gal 10')) / 3.78541).toFixed(2) + ' gal' },
  { name: 'gal2l', category: 'qmath', description: 'US gallons → liters', run: ({ argv }) => (Number(need(argv[0], '?gal2l 5')) * 3.78541).toFixed(2) + ' L' },
  // ---- more text tools ----
  { name: 'words', category: 'qtext', description: 'Count words', run: ({ args }) => String(need(args, '?words <text>').trim().split(/\s+/).length) },
  { name: 'vowels', category: 'qtext', description: 'Count vowels', run: ({ args }) => String((need(args, '?vowels <text>').match(/[aeiou]/gi) || []).length) },
  { name: 'consonants', category: 'qtext', description: 'Count consonants', run: ({ args }) => String((need(args, '?consonants <text>').match(/[bcdfghjklmnpqrstvwxyz]/gi) || []).length) },
  { name: 'dedupe', category: 'qtext', description: 'Remove duplicate words', run: ({ args }) => [...new Set(need(args, '?dedupe <text>').split(/\s+/))].join(' ') },
  { name: 'unique', category: 'qtext', description: 'Unique words, sorted', run: ({ args }) => [...new Set(need(args, '?unique <text>').toLowerCase().split(/\s+/))].sort().join(' ') },
  { name: 'sortwords', category: 'qtext', description: 'Sort words A→Z', run: ({ args }) => need(args, '?sortwords <text>').split(/\s+/).sort().join(' ') },
  { name: 'shuffle', category: 'qtext', description: 'Shuffle the words', run: ({ args }) => { const w = need(args, '?shuffle <text>').split(/\s+/); for (let i = w.length - 1; i > 0; i--) { const j = rint(0, i); [w[i], w[j]] = [w[j], w[i]]; } return w.join(' '); } },
  { name: 'acronym', aliases: ['initials'], category: 'qtext', description: 'First letters → acronym', run: ({ args }) => need(args, '?acronym <text>').split(/\s+/).map((w) => (w[0] || '').toUpperCase()).join('') },
  { name: 'repeat', category: 'qtext', description: 'Repeat text N times', run: ({ argv }) => { const n = Math.min(50, Math.max(1, parseInt(argv[0], 10) || 0)); const t = argv.slice(1).join(' '); if (!t) throw new Error('Usage: ?repeat 3 hi'); return (t + ' ').repeat(n).trim().slice(0, 1900); } },
  { name: 'mirror', category: 'qtext', description: 'Reverse letters in each word', run: ({ args }) => need(args, '?mirror <text>').split(/\s+/).map((w) => [...w].reverse().join('')).join(' ') },
  { name: 'strike', aliases: ['strikethrough'], category: 'qtext', description: 'S̶t̶r̶i̶k̶e̶ text', run: ({ args }) => [...need(args, '?strike <text>')].map((c) => c + '̶').join('') },
  { name: 'spoiler', category: 'qtext', description: 'Wrap in a ||spoiler||', run: ({ args }) => '||' + need(args, '?spoiler <text>') + '||' },
  { name: 'quote', category: 'qtext', description: 'Blockquote your text', run: ({ args }) => need(args, '?quote <text>').split('\n').map((l) => '> ' + l).join('\n') },
  { name: 'zalgo', category: 'qtext', description: 'Z̸a̷l̴g̶o̵ glitch text', run: ({ args }) => { const marks = [0x300, 0x301, 0x302, 0x303, 0x304, 0x306, 0x308, 0x30a, 0x30c, 0x323, 0x324, 0x325, 0x330, 0x331]; return [...need(args, '?zalgo <text>')].map((c) => c + Array.from({ length: rint(1, 4) }, () => String.fromCharCode(pick(marks))).join('')).join(''); } },
  { name: 'smallcaps', category: 'qtext', description: 'ꜱᴍᴀʟʟ ᴄᴀᴘꜱ', run: ({ args }) => { const m = { a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 's', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ' }; return [...need(args, '?smallcaps <text>').toLowerCase()].map((c) => m[c] || c).join(''); } },
  { name: 'bubble', category: 'qtext', description: 'Ⓑⓤⓑⓑⓛⓔ text', run: ({ args }) => [...need(args, '?bubble <text>')].map((c) => { const l = c.toLowerCase(); return /[a-z]/.test(l) ? String.fromCodePoint(0x24d0 + l.charCodeAt(0) - 97) : c; }).join('') },
  { name: 'sha1', category: 'qtext', description: 'SHA-1 hash', run: ({ args }) => createHash('sha1').update(need(args, '?sha1 <text>')).digest('hex') },
  { name: 'sha512', category: 'qtext', description: 'SHA-512 hash', run: ({ args }) => createHash('sha512').update(need(args, '?sha512 <text>')).digest('hex') },
  // ---- generators / utilities ----
  { name: 'pin', category: 'qutil', description: 'Random PIN (4–8 digits)', run: ({ argv }) => { const n = Math.min(8, Math.max(4, parseInt(argv[0], 10) || 4)); return Array.from({ length: n }, () => rint(0, 9)).join(''); } },
  { name: 'randomcolor', aliases: ['randcolor'], category: 'qutil', description: 'Random hex color', run: () => '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0') },
  { name: 'timestamp', aliases: ['ts'], category: 'qutil', description: 'Current Unix timestamp', run: () => String(Math.floor(Date.now() / 1000)) },
  { name: 'now', category: 'qutil', description: 'Current UTC time', run: () => new Date().toUTCString() },
  { name: 'epoch', category: 'qutil', description: 'Unix time → date', run: ({ argv }) => { const n = parseInt(need(argv[0], '?epoch 1700000000'), 10); return new Date(n * (n < 1e12 ? 1000 : 1)).toUTCString(); } },
  { name: 'lorem', category: 'qutil', description: 'Lorem ipsum words', run: ({ argv }) => { const w = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua'.split(' '); const n = Math.min(100, Math.max(1, parseInt(argv[0], 10) || 10)); return Array.from({ length: n }, () => pick(w)).join(' '); } },
  { name: 'yesno', category: 'qfun', description: 'Random yes or no', run: () => pick(['✅ Yes', '❌ No', '🤷 Maybe']) },
  { name: 'truth', category: 'qfun', description: 'Random truth question', run: () => pick(['What’s your biggest fear?', 'Last lie you told?', 'Biggest regret?', 'Craziest dream you remember?', 'Who do you text the most?']) },
  { name: 'dare', category: 'qfun', description: 'Random dare', run: () => pick(['Change your nickname to “I lost a bet”.', 'Send an emoji-only message for 10 minutes.', 'Text the 3rd person in your DMs “hi”.', 'Speak in rhymes for 3 messages.', 'Do 10 pushups.']) },
  { name: 'nhie', aliases: ['neverhaveiever'], category: 'qfun', description: 'Never-have-I-ever prompt', run: () => 'Never have I ever ' + pick(['gone a full day without my phone.', 'broken a bone.', 'been on TV.', 'stayed up 24h straight.', 'rage-quit a game.', 'eaten pineapple on pizza.']) },
  { name: 'tableflip', category: 'qfun', description: '(╯°□°)╯︵ ┻━┻', run: () => '(╯°□°)╯︵ ┻━┻' },
  { name: 'unflip', category: 'qfun', description: '┬─┬ ノ( ゜-゜ノ)', run: () => '┬─┬ ノ( ゜-゜ノ)' },
  { name: 'shrug', category: 'qfun', description: 'Shrug emoticon', run: () => '¯\\_(ツ)_/¯' },
  { name: 'lenny', category: 'qfun', description: 'Lenny face', run: () => '( ͡° ͜ʖ ͡°)' },
  { name: 'disapprove', category: 'qfun', description: 'Look of disapproval', run: () => 'ಠ_ಠ' },

  // ============ v3 batch — more REAL commands (biggest library flex) ============
  { name: 'rot47', category: 'qtext', description: 'ROT47 cipher', run: ({ args }) => [...need(args, '?rot47 <text>')].map((c) => { const x = c.charCodeAt(0); return x >= 33 && x <= 126 ? String.fromCharCode(33 + ((x - 33 + 47) % 94)) : c; }).join('') },
  { name: 'htmlencode', category: 'qtext', description: 'Escape HTML entities', run: ({ args }) => need(args, '?htmlencode <text>').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) },
  { name: 'htmldecode', category: 'qtext', description: 'Unescape HTML entities', run: ({ args }) => need(args, '?htmldecode <text>').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'") },
  { name: 'sentencecase', category: 'qtext', description: 'Sentence case', run: ({ args }) => need(args, '?sentencecase <text>').toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, (c) => c.toUpperCase()) },
  { name: 'constcase', aliases: ['screamingsnake'], category: 'qtext', description: 'CONSTANT_CASE', run: ({ args }) => need(args, '?constcase <text>').trim().replace(/\s+/g, '_').toUpperCase() },
  { name: 'removevowels', category: 'qtext', description: 'Remove vowels', run: ({ args }) => need(args, '?removevowels <text>').replace(/[aeiou]/gi, '') },
  { name: 'removespaces', category: 'qtext', description: 'Remove all spaces', run: ({ args }) => need(args, '?removespaces <text>').replace(/\s+/g, '') },
  { name: 'charcount', category: 'qtext', description: 'Count non-space characters', run: ({ args }) => String(need(args, '?charcount <text>').replace(/\s/g, '').length) },
  { name: 'extractnums', category: 'qtext', description: 'Pull numbers from text', run: ({ args }) => (need(args, '?extractnums <text>').match(/-?\d+(\.\d+)?/g) || ['(none)']).join(', ') },
  { name: 'extractemails', category: 'qtext', description: 'Pull emails from text', run: ({ args }) => (need(args, '?extractemails <text>').match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || ['(none)']).join(', ') },
  { name: 'extracturls', category: 'qtext', description: 'Pull URLs from text', run: ({ args }) => (need(args, '?extracturls <text>').match(/https?:\/\/[^\s]+/g) || ['(none)']).join(', ') },
  { name: 'longest', category: 'qtext', description: 'Longest word', run: ({ args }) => need(args, '?longest <text>').split(/\s+/).reduce((a, b) => (b.length > a.length ? b : a), '') },
  { name: 'shortest', category: 'qtext', description: 'Shortest word', run: ({ args }) => need(args, '?shortest <text>').split(/\s+/).reduce((a, b) => (b.length < a.length ? b : a)) },
  { name: 'censor', category: 'qtext', description: 'Star out the middle of words', run: ({ args }) => need(args, '?censor <text>').replace(/\b(\w)(\w+)(\w)\b/g, (m, a, b, c) => a + '*'.repeat(b.length) + c) },
  { name: 'syllables', category: 'qtext', description: 'Rough syllable count', run: ({ args }) => String((need(args, '?syllables <text>').toLowerCase().match(/[aeiouy]+/g) || []).length) },
  { name: 'triangular', category: 'qmath', description: 'Nth triangular number', run: ({ argv }) => { const n = +need(argv[0], '?triangular 10'); return String(n * (n + 1) / 2); } },
  { name: 'isperfect', category: 'qmath', description: 'Perfect number check', run: ({ argv }) => { const n = +need(argv[0], '?isperfect 28'); let s = 0; for (let i = 1; i < n; i++) if (n % i === 0) s += i; return s === n ? '✅ perfect' : '❌ not perfect'; } },
  { name: 'isarmstrong', category: 'qmath', description: 'Armstrong number check', run: ({ argv }) => { const s = need(argv[0], '?isarmstrong 153'); const p = s.length; return [...s].reduce((a, d) => a + (+d) ** p, 0) === +s ? '✅ yes' : '❌ no'; } },
  { name: 'palindromenum', category: 'qmath', description: 'Is the number a palindrome?', run: ({ argv }) => { const s = need(argv[0], '?palindromenum 12321').replace(/\D/g, ''); return s === [...s].reverse().join('') ? '✅ palindrome' : '❌ no'; } },
  { name: 'primesupto', category: 'qmath', description: 'List primes up to N', run: ({ argv }) => { const n = Math.min(500, +need(argv[0], '?primesupto 50')); const out = []; for (let i = 2; i <= n; i++) { let p = 1; for (let d = 2; d * d <= i; d++) if (i % d === 0) { p = 0; break; } if (p) out.push(i); } return out.join(', ') || '(none)'; } },
  { name: 'nthprime', category: 'qmath', description: 'The Nth prime', run: ({ argv }) => { const n = Math.min(10000, +need(argv[0], '?nthprime 10')); let c = 0; let x = 1; while (c < n) { x++; let p = 1; for (let d = 2; d * d <= x; d++) if (x % d === 0) { p = 0; break; } if (p) c++; } return String(x); } },
  { name: 'divisors', category: 'qmath', description: 'All divisors of a number', run: ({ argv }) => { const n = +need(argv[0], '?divisors 24'); const out = []; for (let i = 1; i <= n; i++) if (n % i === 0) out.push(i); return out.join(', '); } },
  { name: 'cbrt', category: 'qmath', description: 'Cube root', run: ({ argv }) => String(Math.cbrt(+need(argv[0], '?cbrt 27'))) },
  { name: 'variance', category: 'qmath', description: 'Variance of numbers', run: ({ argv }) => { const n = nums(argv); if (n.length < 2) throw new Error('Usage: ?variance 2 4 6'); const m = n.reduce((a, b) => a + b) / n.length; return (n.reduce((a, b) => a + (b - m) ** 2, 0) / n.length).toFixed(4); } },
  { name: 'sumto', category: 'qmath', description: 'Sum 1..N', run: ({ argv }) => { const n = +need(argv[0], '?sumto 100'); return String(n * (n + 1) / 2); } },
  { name: 'percentof', category: 'qmath', description: 'X% of Y', run: ({ argv }) => { const [p, y] = nums(argv); if (p == null || y == null) throw new Error('Usage: ?percentof 20 150'); return String(p / 100 * y); } },
  { name: 'roundto', category: 'qmath', description: 'Round to N decimals', run: ({ argv }) => { const v = +argv[0]; const d = +argv[1] || 0; if (Number.isNaN(v)) throw new Error('Usage: ?roundto 3.14159 2'); return v.toFixed(d); } },
  { name: 'clamp', category: 'qmath', description: 'Clamp value between min & max', run: ({ argv }) => { const [v, lo, hi] = nums(argv); if ([v, lo, hi].some((x) => x == null)) throw new Error('Usage: ?clamp 12 0 10'); return String(Math.min(hi, Math.max(lo, v))); } },
  { name: 'ratio', category: 'qmath', description: 'Simplify a ratio a:b', run: ({ argv }) => { const a = +argv[0]; const b = +argv[1]; if ([a, b].some(Number.isNaN)) throw new Error('Usage: ?ratio 16 9'); const g = (x, y) => (y ? g(y, x % y) : x); const d = g(a, b) || 1; return `${a / d}:${b / d}`; } },
  { name: 'kb2mb', category: 'qmath', description: 'KB → MB', run: ({ argv }) => (+need(argv[0], '?kb2mb 2048') / 1024).toFixed(3) + ' MB' },
  { name: 'mb2gb', category: 'qmath', description: 'MB → GB', run: ({ argv }) => (+need(argv[0], '?mb2gb 4096') / 1024).toFixed(3) + ' GB' },
  { name: 'gb2mb', category: 'qmath', description: 'GB → MB', run: ({ argv }) => (+need(argv[0], '?gb2mb 2') * 1024) + ' MB' },
  { name: 'ft2in', category: 'qmath', description: 'Feet → inches', run: ({ argv }) => (+need(argv[0], '?ft2in 6') * 12) + ' in' },
  { name: 'in2ft', category: 'qmath', description: 'Inches → feet', run: ({ argv }) => (+need(argv[0], '?in2ft 72') / 12).toFixed(2) + ' ft' },
  { name: 'l2ml', category: 'qmath', description: 'Liters → mL', run: ({ argv }) => (+need(argv[0], '?l2ml 2') * 1000) + ' mL' },
  { name: 'min2sec', category: 'qmath', description: 'Minutes → seconds', run: ({ argv }) => (+need(argv[0], '?min2sec 5') * 60) + ' s' },
  { name: 'hr2min', category: 'qmath', description: 'Hours → minutes', run: ({ argv }) => (+need(argv[0], '?hr2min 2') * 60) + ' min' },
  { name: 'day2hr', category: 'qmath', description: 'Days → hours', run: ({ argv }) => (+need(argv[0], '?day2hr 3') * 24) + ' h' },
  { name: 'knots2mph', category: 'qmath', description: 'Knots → mph', run: ({ argv }) => (+need(argv[0], '?knots2mph 100') * 1.15078).toFixed(2) + ' mph' },
  { name: 'atm2psi', category: 'qmath', description: 'Atmospheres → psi', run: ({ argv }) => (+need(argv[0], '?atm2psi 1') * 14.6959).toFixed(2) + ' psi' },
  { name: 'sec2hms', category: 'qmath', description: 'Seconds → H:M:S', run: ({ argv }) => { let s = Math.floor(+need(argv[0], '?sec2hms 3661')); const h = Math.floor(s / 3600); s %= 3600; return `${h}h ${Math.floor(s / 60)}m ${s % 60}s`; } },
  { name: 'rollstats', category: 'qutil', description: 'D&D stats (4d6 drop lowest ×6)', run: () => Array.from({ length: 6 }, () => { const r = Array.from({ length: 4 }, () => rint(1, 6)).sort((a, b) => a - b); return r[1] + r[2] + r[3]; }).join(', ') },
  { name: 'randname', category: 'qutil', description: 'Random first name', run: () => pick(['Alex', 'Jordan', 'Casey', 'Riley', 'Morgan', 'Taylor', 'Jamie', 'Avery', 'Quinn', 'Sky', 'Sam', 'Drew', 'Blake', 'Reese']) },
  { name: 'randemoji', category: 'qutil', description: 'Random emoji', run: () => pick(['😀', '🔥', '🚀', '🎉', '🌈', '⚡', '💎', '🍕', '🐉', '👑', '🎮', '🛸', '🦖', '🌊', '🎸', '🍩', '🤖', '🏆']) },
  { name: 'playingcard', aliases: ['card'], category: 'qutil', description: 'Draw a playing card', run: () => pick(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']) + pick(['♠️', '♥️', '♦️', '♣️']) },
  { name: 'tarot', category: 'qutil', description: 'Draw a tarot card', run: () => pick(['The Fool', 'The Magician', 'The High Priestess', 'The Empress', 'The Emperor', 'The Lovers', 'The Chariot', 'Strength', 'The Hermit', 'Wheel of Fortune', 'Justice', 'Death', 'Temperance', 'The Tower', 'The Star', 'The Moon', 'The Sun', 'The World']) },
  { name: 'randbool', category: 'qutil', description: 'true or false', run: () => (Math.random() < 0.5 ? 'true' : 'false') },
  { name: 'randhex', category: 'qutil', description: 'Random hex string', run: ({ argv }) => { const n = Math.min(64, Math.max(2, parseInt(argv[0], 10) || 8)); return Array.from({ length: n }, () => '0123456789abcdef'[rint(0, 15)]).join(''); } },
  { name: 'badge', category: 'qutil', description: 'Random badge number', run: () => String(rint(100, 9999)) },
  { name: 'plategen', category: 'qutil', description: 'Random license plate', run: () => Array.from({ length: 3 }, () => 'ABCDEFGHJKLMNPRSTUVWXYZ'[rint(0, 22)]).join('') + '-' + rint(100, 999) },
  { name: 'callsign', category: 'qutil', description: 'Random police callsign', run: () => pick(['1', '2', '3', '4']) + '-' + pick(['ADAM', 'BOY', 'CHARLES', 'DAVID', 'EDWARD', 'FRANK']) + '-' + rint(1, 99) },
  { name: 'tencode', category: 'qutil', description: 'Look up a 10-code', run: ({ argv }) => { const m = { '10-4': 'Acknowledged', '10-7': 'Out of service', '10-8': 'In service', '10-9': 'Repeat', '10-20': 'Location', '10-50': 'Vehicle accident', '10-80': 'Pursuit', '10-97': 'On scene', '10-99': 'Officer needs help' }; return m[(argv[0] || '').trim()] || 'Unknown 10-code. Try 10-4, 10-20, 10-99…'; } },
  { name: 'jsonmin', category: 'qutil', description: 'Minify JSON', run: ({ args }) => { try { return JSON.stringify(JSON.parse(need(args, '?jsonmin {json}'))); } catch (e) { return '⚠️ Invalid JSON: ' + e.message; } } },
  { name: 'jsonpretty', category: 'qutil', description: 'Pretty-print JSON', run: ({ args }) => { try { return '```json\n' + JSON.stringify(JSON.parse(need(args, '?jsonpretty {json}')), null, 2).slice(0, 1800) + '\n```'; } catch (e) { return '⚠️ Invalid JSON: ' + e.message; } } },
  { name: 'rgb2hex', category: 'qutil', description: 'RGB → hex', run: ({ argv }) => { const [r, g, b] = nums(argv); if ([r, g, b].some((x) => x == null)) throw new Error('Usage: ?rgb2hex 255 100 50'); return '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join(''); } },
  { name: 'hex2rgb', category: 'qutil', description: 'Hex → RGB', run: ({ argv }) => { const n = parseInt(need(argv[0], '?hex2rgb #ff6432').replace('#', ''), 16); return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`; } },
  { name: 'luhn', category: 'qutil', description: 'Luhn checksum validity', run: ({ argv }) => { const s = need(argv[0], '?luhn 4539578763621486').replace(/\D/g, ''); let sum = 0; let alt = false; for (let i = s.length - 1; i >= 0; i--) { let d = +s[i]; if (alt) { d *= 2; if (d > 9) d -= 9; } sum += d; alt = !alt; } return sum % 10 === 0 ? '✅ valid checksum' : '❌ invalid'; } },
  { name: 'riddle', category: 'qfun', description: 'A riddle', run: () => pick(['What has keys but no locks? A piano.', 'What gets wetter as it dries? A towel.', 'What has a head and tail but no body? A coin.', 'The more you take, the more you leave behind. Footsteps.', 'What has hands but cannot clap? A clock.']) },
  { name: 'affirm', aliases: ['affirmation'], category: 'qfun', description: 'A daily affirmation', run: () => pick(['You are capable of amazing things.', 'Progress, not perfection.', 'You’ve got this.', 'Your effort today builds tomorrow.', 'You are enough.']) },
  { name: 'horoscope', category: 'qfun', description: 'A vague horoscope', run: () => pick(['A surprise message changes your day.', 'Trust your gut on a small decision.', 'Money luck favors the patient today.', 'An old friend crosses your mind for a reason.', 'Say yes to the thing you keep avoiding.']) },
  { name: 'koan', category: 'qfun', description: 'A zen koan', run: () => pick(['What is the sound of one hand clapping?', 'Before enlightenment, chop wood, carry water.', 'The obstacle is the path.', 'When you can do nothing, what can you do?', 'Not the wind, not the flag; mind is moving.']) },
  { name: 'excuse', category: 'qfun', description: 'A random excuse', run: () => 'Sorry, ' + pick(['my Wi-Fi died.', 'the dog ate my keyboard.', 'I was fighting a raid.', 'time zones are hard.', 'my alarm betrayed me.', 'Mercury is in retrograde.']) },
  { name: 'conspiracy', category: 'qfun', description: 'A silly conspiracy', run: () => pick(['Birds are government drones.', 'The moon is a hologram.', 'Pigeons work in shifts.', 'Wi-Fi is just tiny ghosts.', 'Autocorrect is sentient.']) },
  { name: 'bandname', category: 'qfun', description: 'Random band name', run: () => 'The ' + pick(['Electric', 'Velvet', 'Midnight', 'Neon', 'Broken', 'Silent', 'Cosmic', 'Wild']) + ' ' + pick(['Foxes', 'Waves', 'Kings', 'Echoes', 'Machines', 'Saints', 'Rebels', 'Ghosts']) },
  { name: 'superhero', category: 'qfun', description: 'Random superhero name', run: () => pick(['Captain', 'The', 'Doctor', 'Mega', 'Ultra']) + ' ' + pick(['Thunder', 'Shadow', 'Phoenix', 'Volt', 'Titan', 'Blaze', 'Frost', 'Nova']) },
  { name: 'gamertag', category: 'qfun', description: 'Random gamertag', run: () => pick(['xX', '', 'Pro', 'No', 'The']) + pick(['Sniper', 'Ghost', 'Reaper', 'Shadow', 'Dragon', 'Wolf', 'Ninja', 'Storm']) + rint(1, 999) + pick(['Xx', '', 'YT', 'TTV']) },
  { name: 'dispatch', category: 'qfun', description: 'Random dispatch scenario', run: () => pick(['🚨 10-90 bank alarm at First National.', '🚗 Reckless driver on the highway.', '🔫 Shots fired downtown.', '🚑 Medical emergency at the park.', '🔥 Structure fire on Main St.', '🚓 Foot pursuit near the mall.']) },

  // ---------------- GLITCH REPORT (category: qutil) ----------------
  // Attach a screenshot/photo + describe the glitch. The image is downloaded and
  // saved to data/glitch-reports/ (with a JSON of full context + an index.md),
  // so the dev can open the actual screenshot and see exactly what's wrong.
  {
    name: 'glitch', aliases: ['bug', 'report', 'snap'], category: 'qutil',
    description: 'Report a glitch — attach a screenshot + a description; saved for the dev to view',
    run: async ({ args, message }) => {
      const att = message.attachments?.first?.();
      if (!att) {
        return '📸 **Glitch report** — attach a screenshot/photo of the glitch, then describe it.\nExample: `?glitch the CAD map is blank and the panic button did nothing` *(with an image attached)*';
      }
      const context = (args || '').trim();
      const dir = path.join(process.cwd(), 'data', 'glitch-reports');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const ext = ((att.name?.split('.').pop() || att.contentType?.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 5)) || 'bin';
      const base = `glitch-${stamp}-${message.author?.id || 'anon'}`;
      let savedFile = null;
      try {
        await fs.mkdir(dir, { recursive: true });
        const res = await fetch(att.url);
        if (res.ok) { savedFile = `${base}.${ext}`; await fs.writeFile(path.join(dir, savedFile), Buffer.from(await res.arrayBuffer())); }
        const meta = {
          time: new Date().toISOString(),
          context: context || '(none provided)',
          user: { id: message.author?.id, tag: message.author?.tag || message.author?.username },
          guild: { id: message.guild?.id, name: message.guild?.name },
          channel: { id: message.channel?.id, name: message.channel?.name },
          attachment: { name: att.name, type: att.contentType, size: att.size, url: att.url },
          savedFile,
        };
        await fs.writeFile(path.join(dir, `${base}.json`), JSON.stringify(meta, null, 2));
        await fs.appendFile(path.join(dir, 'index.md'), `- ${meta.time} · **${meta.context}** · ${meta.user.tag || '?'} · ${meta.guild.name || 'DM'} · file: \`${savedFile || '(download failed)'}\`\n`);
      } catch (e) {
        return `⚠️ Could not save the report: ${e.message}`;
      }
      return `✅ **Glitch report saved.**\n📎 ${att.name} · ${Math.round((att.size || 0) / 1024)} KB\n📝 ${context || '_no description given_'}\n\n📁 \`data/glitch-reports/${savedFile || base + '.json'}\`\nThe dev can now open the screenshot + full context. Thanks for the report! 🔧`;
    },
  },

  // ==========================================================================
  // 🌐 LIVE API COMMANDS — real data from free public APIs (see funApis.js).
  // ==========================================================================
  {
    name: 'trivia', aliases: ['quiz'], category: 'qapi',
    description: 'Interactive trivia — click A/B/C/D to answer (15s)',
    async run({ argv, message }) {
      const q = await api.getTrivia({ type: /^(tf|bool|truefalse)$/i.test(argv[0] || '') ? 'boolean' : 'multiple' });
      const letters = ['🇦', '🇧', '🇨', '🇩'];
      const embed = new EmbedBuilder().setColor(0x9b59b6)
        .setAuthor({ name: `Trivia · ${q.category}` })
        .setTitle(q.question.slice(0, 256))
        .setDescription(q.options.map((o, i) => `${letters[i]} ${o}`).join('\n'))
        .setFooter({ text: `Difficulty: ${q.difficulty} · 15 seconds to answer` });
      const row = new ActionRowBuilder().addComponents(
        q.options.map((o, i) => new ButtonBuilder().setCustomId(`triv:${i}`).setEmoji(letters[i]).setStyle(ButtonStyle.Secondary)),
      );
      const sent = await message.reply({ embeds: [embed], components: [row] });
      const correctIdx = q.options.indexOf(q.correct);
      const scores = new Map(); // userId -> tag (first correct wins the point display)
      const answered = new Set();
      const col = sent.createMessageComponentCollector({ componentType: ComponentType.Button, time: 15000 });
      col.on('collect', async (i) => {
        if (answered.has(i.user.id)) return i.reply({ content: 'You already answered!', ephemeral: true }).catch(() => {});
        answered.add(i.user.id);
        const idx = Number(i.customId.split(':')[1]);
        if (idx === correctIdx) { scores.set(i.user.id, i.user.username); await i.reply({ content: '✅ Correct!', ephemeral: true }).catch(() => {}); }
        else await i.reply({ content: `❌ Nope — you picked ${letters[idx]}.`, ephemeral: true }).catch(() => {});
      });
      col.on('end', async () => {
        const winners = [...scores.values()];
        const done = EmbedBuilder.from(embed).setColor(0x2ecc71)
          .setDescription(q.options.map((o, i) => `${i === correctIdx ? '✅' : letters[i]} ${o}`).join('\n'))
          .addFields({ name: '🏆 Got it right', value: winners.length ? winners.map((w) => `• ${w}`).join('\n').slice(0, 1024) : '_Nobody this time!_' })
          .setFooter({ text: `Answer: ${q.correct}` });
        await sent.edit({ embeds: [done], components: [] }).catch(() => {});
      });
    },
  },
  {
    name: 'earth4k', aliases: ['cinematic', 'earthart', 'hero'], category: 'qapi',
    description: 'A cinematic hero render of Earth from space (?earth4k [west])',
    async run({ args, message }) { await sendCinematicEarth(message, args.trim()); },
  },
  {
    name: 'earthspin', aliases: ['spin', 'rotate', 'earthvideo', 'timelapse'], category: 'qapi',
    description: 'Generate a VIDEO of Earth rotating (NASA EPIC timelapse)',
    async run({ args, message }) { await sendEarthSpin(message, args.trim()); },
  },
  {
    name: 'earthhd', aliases: ['goes', 'fulldisk', 'zoomearth', 'earthlive'], category: 'qapi',
    description: 'Live GOES full-disk Earth — zoom up to 12× & pan (?earthhd [west])',
    async run({ args, message }) { await sendGoesViewer(message, args.trim()); },
  },
  {
    name: 'epic', aliases: ['earth', 'earthpic', 'dscovr', 'wholeearth'], category: 'qapi',
    description: 'Real photo of the whole Earth from space + explanation (NASA EPIC)',
    async run({ args, message }) {
      const e = await api.getEpic(args.trim());
      const loc = e.lat != null ? `**${e.lat.toFixed(1)}°, ${e.lon.toFixed(1)}°**` : 'the sunlit side';
      const explain =
        `🌍 A real photo of the **entire sunlit face of Earth**, taken by NASA's **EPIC** camera aboard the ` +
        `**DSCOVR** satellite — parked ~**1,000,000 miles (1.5M km)** away at **Lagrange Point 1**, where it stares ` +
        `back at our planet. The center of this view sits over ${loc}. You're seeing **live cloud systems, ocean ` +
        `colors, and the day side** of a rotating Earth, straight from deep space.`;
      const embed = new EmbedBuilder().setColor(0x1b4d8c)
        .setTitle('🌍 Earth from 1,000,000 miles away')
        .setDescription(explain)
        .setImage(e.url)
        .setFooter({ text: `NASA EPIC · DSCOVR at L1 · ${e.date}` });

      // Voice explanation, too, if the user is in a voice channel.
      const vc = message.member?.voice?.channel;
      if (vc) {
        const spoken =
          `This is a real photo of the entire sunlit face of Earth, captured by NASA's EPIC camera aboard the DSCOVR ` +
          `satellite, about one million miles away at Lagrange Point One. ` +
          (e.lat != null ? `The center of this view is over latitude ${e.lat.toFixed(0)}, longitude ${e.lon.toFixed(0)}. ` : '') +
          `You are seeing live clouds, oceans, and the day side of our rotating planet, from deep space.`;
        try { await speakInChannel(vc, spoken); embed.addFields({ name: '🔊 Voice', value: `Explaining out loud in **${vc.name}**…` }); }
        catch { /* no perms or TTS hiccup — the text explanation still posts */ }
      }
      return { embeds: [embed] };
    },
  },
  {
    name: 'space', aliases: ['apod'], category: 'qapi',
    description: 'NASA Astronomy Picture of the Day (?space [YYYY-MM-DD])',
    async run({ args }) {
      const a = await api.getApod(args.trim());
      const embed = new EmbedBuilder().setColor(0x0b3d91)
        .setTitle(`🔭 ${a.title || 'APOD'}`.slice(0, 256))
        .setDescription((a.explanation || '').slice(0, 3000))
        .setFooter({ text: `NASA APOD · ${a.date || ''}${a.copyright ? ' · © ' + a.copyright : ''}` });
      if (a.media_type === 'image') embed.setImage(a.hdurl || a.url);
      else if (a.url) embed.addFields({ name: 'Media', value: a.url });
      return { embeds: [embed] };
    },
  },
  {
    name: 'mars', aliases: ['rover', 'marsrover'], category: 'qapi',
    description: 'Photos from a Mars rover (?mars [curiosity|perseverance] [sol])',
    async run({ argv }) {
      const rover = /[a-z]/i.test(argv[0] || '') ? argv[0] : 'curiosity';
      const sol = argv.find((t) => /^\d+$/.test(t)) || 1000;
      const { photos, rover: r, sol: s } = await api.getMars(rover, sol);
      if (!photos.length) return `📷 No photos from **${r}** on sol **${s}**. Try another sol (e.g. \`?mars ${r} 1500\`).`;
      const p = photos[Math.floor(Math.random() * photos.length)];
      const embed = new EmbedBuilder().setColor(0xc1440e)
        .setTitle(`🔴 Mars · ${r} · sol ${s}`)
        .setDescription(`📸 ${p.camera?.full_name || p.camera?.name || 'Camera'} · Earth date ${p.earth_date}\n${photos.length} photos on this sol.`)
        .setImage(p.img_src).setFooter({ text: 'NASA Mars Rover Photos' });
      return { embeds: [embed] };
    },
  },
  {
    name: 'catmeme', aliases: ['catsays'], category: 'qapi',
    description: 'A cat photo with your caption on it (?catmeme <text>)',
    run({ args }) {
      const embed = new EmbedBuilder().setColor(0xf1c40f)
        .setTitle('🐱 Cat says…').setImage(api.catMemeUrl(args))
        .setFooter({ text: 'cataas.com' });
      return { embeds: [embed] };
    },
  },
  {
    name: 'cat', aliases: ['kitty'], category: 'qapi',
    description: 'A random cat image',
    run() {
      return { embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle('🐈 Here’s a cat').setImage(api.catMemeUrl('')).setFooter({ text: 'cataas.com' })] };
    },
  },
  {
    name: 'dog', aliases: ['puppy', 'doggo'], category: 'qapi',
    description: 'A random dog photo + breed info',
    async run() {
      const d = await api.getDog();
      const b = d.breeds?.[0];
      const embed = new EmbedBuilder().setColor(0xa0785a)
        .setTitle(b ? `🐶 ${b.name}` : '🐶 Here’s a dog')
        .setImage(d.url).setFooter({ text: 'TheDogAPI' });
      if (b) {
        const fields = [];
        if (b.breed_group) fields.push({ name: '📋 Group', value: b.breed_group, inline: true });
        if (b.life_span) fields.push({ name: '❤️ Lifespan', value: b.life_span, inline: true });
        if (b.weight?.imperial) fields.push({ name: '⚖️ Weight', value: `${b.weight.imperial} lbs`, inline: true });
        if (b.bred_for) fields.push({ name: '🛠️ Bred For', value: b.bred_for.slice(0, 1024) });
        if (b.temperament) fields.push({ name: '🐕 Temperament', value: b.temperament.slice(0, 1024) });
        if (b.origin) fields.push({ name: '🌍 Origin', value: b.origin, inline: true });
        if (fields.length) embed.addFields(fields.slice(0, 25));
      } else {
        embed.setDescription('_(No breed info on this one — just a good boy.)_');
      }
      return { embeds: [embed] };
    },
  },
  {
    name: 'animal', aliases: ['creature', 'beast', 'species'], category: 'qapi',
    description: 'Search ANY animal by name (?animal axolotl)',
    async run({ args }) {
      if (!args.trim()) return '🔎 **Search any animal** — `?animal <name>`\nExamples: `?animal axolotl` · `?animal red panda` · `?animal blue whale` · `?animal platypus`';
      const a = await api.getAnimal(args);
      const embed = new EmbedBuilder().setColor(0x2ecc71)
        .setTitle(`🐾 ${a.title}`).setURL(a.url || null)
        .setDescription(a.extract.slice(0, 1200))
        .setFooter({ text: 'via Wikipedia' });
      if (a.image) embed.setImage(a.image);
      return { embeds: [embed] };
    },
  },
  {
    name: 'fox', aliases: ['floof'], category: 'qapi',
    description: 'A random fox photo',
    async run() {
      return { embeds: [new EmbedBuilder().setColor(0xe67e22).setTitle('🦊 Here’s a fox').setImage(await api.getFox()).setFooter({ text: 'randomfox.ca' })] };
    },
  },
  {
    name: 'duck', aliases: ['quack'], category: 'qapi',
    description: 'A random duck photo',
    async run() {
      return { embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle('🦆 Quack!').setImage(await api.getDuck()).setFooter({ text: 'random-d.uk' })] };
    },
  },
  {
    name: 'bird', aliases: ['birb'], category: 'qapi',
    description: 'A random bird photo',
    async run() {
      return { embeds: [new EmbedBuilder().setColor(0x3498db).setTitle('🐦 Here’s a bird').setImage(await api.getBird()).setFooter({ text: 'shibe.online' })] };
    },
  },
  {
    name: 'translate', aliases: ['dialect', 'yoda'], category: 'qapi',
    description: `Translate text to a dialect (?translate <${api.DIALECTS.slice(0, 4).join('|')}|…> <text>)`,
    async run({ argv, args, name }) {
      // "?yoda hello there" shortcut, else first word is the dialect.
      let dialect = name === 'yoda' ? 'yoda' : (argv[0] || '');
      let text = name === 'yoda' ? args : argv.slice(1).join(' ');
      if (!text.trim()) return `Usage: \`?translate <dialect> <text>\`\nDialects: ${api.DIALECTS.join(', ')}`;
      const r = await api.translateDialect(dialect, text);
      return `🗣️ **${r.dialect}**\n> ${r.translated}`.slice(0, 1900);
    },
  },
  {
    name: 'anime', aliases: ['mal'], category: 'qapi',
    description: 'Search anime info (?anime <title>)',
    async run({ args }) {
      const a = await api.getAnime(args);
      const embed = new EmbedBuilder().setColor(0x2e51a2)
        .setTitle(`${a.title}${a.year ? ` (${a.year})` : ''}`.slice(0, 256))
        .setURL(a.url)
        .setDescription((a.synopsis || 'No synopsis.').slice(0, 1000))
        .addFields(
          { name: '⭐ Score', value: `${a.score ?? '—'}`, inline: true },
          { name: '📺 Episodes', value: `${a.episodes ?? '—'}`, inline: true },
          { name: '📡 Status', value: `${a.status ?? '—'}`, inline: true },
        )
        .setFooter({ text: 'MyAnimeList via Jikan' });
      if (a.images?.jpg?.image_url) embed.setThumbnail(a.images.jpg.image_url);
      return { embeds: [embed] };
    },
  },
  {
    name: 'character', aliases: ['char'], category: 'qapi',
    description: 'Search an anime character (?character <name>)',
    async run({ args }) {
      const c = await api.getCharacter(args);
      const embed = new EmbedBuilder().setColor(0x2e51a2)
        .setTitle(c.name.slice(0, 256)).setURL(c.url)
        .setDescription((c.about || 'No bio.').slice(0, 900))
        .addFields({ name: '❤️ Favorites', value: `${c.favorites ?? '—'}`, inline: true });
      if (c.images?.jpg?.image_url) embed.setThumbnail(c.images.jpg.image_url);
      return { embeds: [embed] };
    },
  },
  {
    name: 'fact', aliases: ['uselessfact', 'randomfact'], category: 'qapi',
    description: 'A random (useless) fact',
    async run() { return `🧠 **Did you know?**\n${await api.getFact()}`; },
  },
  {
    name: 'advice', aliases: ['adviceslip'], category: 'qapi',
    description: 'A random piece of life advice',
    async run() { return `💡 ${await api.getAdvice()}`; },
  },
  {
    name: 'predict', aliases: ['agify', 'guessage'], category: 'qapi',
    description: 'Predict age + gender from a name (?predict <name>)',
    async run({ args }) {
      const p = await api.predictName(args);
      const bits = [];
      bits.push(`🔮 **${p.name}**`);
      bits.push(`• Likely age: **${p.age ?? '—'}**${p.sampleAge ? ` _(from ${p.sampleAge.toLocaleString()} people)_` : ''}`);
      bits.push(`• Likely gender: **${p.gender ?? '—'}**${p.genderProb != null ? ` _(${Math.round(p.genderProb * 100)}% confident)_` : ''}`);
      return bits.join('\n') + '\n_Based on public census data — just for fun._';
    },
  },
  {
    name: 'quake', aliases: ['earthquake', 'eq'], category: 'qapi',
    description: 'Recent earthquakes + chart (USGS) — ?quake [5.0 | week | big]',
    async run({ args }) {
      const { feed, quakes } = await api.getQuakes(args.trim());
      if (!quakes.length) return `🌎 No earthquakes match **${feed}** right now. Try \`?quake week\` or \`?quake 2.5\`.`;
      const top = quakes.slice().sort((a, b) => (b.properties.mag || 0) - (a.properties.mag || 0)).slice(0, 8);
      const biggest = top[0].properties.mag || 0;
      const color = biggest >= 6 ? 0xe74c3c : biggest >= 4.5 ? 0xe67e22 : 0xf1c40f;
      const lines = top.slice(0, 6).map((q) => {
        const p = q.properties; const depth = Math.round((q.geometry?.coordinates?.[2]) || 0);
        return `**M${(p.mag ?? 0).toFixed(1)}** — ${p.place || 'Unknown'}${p.tsunami ? ' 🌊' : ''}\n> <t:${Math.floor(p.time / 1000)}:R> · depth ${depth} km · [details](${p.url})`;
      });
      const embed = new EmbedBuilder().setColor(color)
        .setTitle(`🌎 Earthquakes — ${feed}`)
        .setDescription(lines.join('\n\n').slice(0, 4096))
        .setImage('attachment://quakes.png')
        .setFooter({ text: `USGS · ${quakes.length} events` });
      return { embeds: [embed], files: [new AttachmentBuilder(renderQuakeCard(top, feed), { name: 'quakes.png' })] };
    },
  },
  {
    name: 'neo', aliases: ['asteroid', 'asteroids', 'nearearth'], category: 'qapi',
    description: 'Near-Earth asteroids + chart (NASA NeoWs) — ?neo [YYYY-MM-DD]',
    async run({ args }) {
      const data = await api.getNeo(args.trim());
      if (!data.objects.length) return `☄️ No tracked near-Earth objects for **${data.date}**.`;
      const haz = data.objects.filter((o) => o.hazardous).length;
      const top = data.objects.slice().sort((a, b) => b.diaMax - a.diaMax).slice(0, 6);
      const lines = top.map((o) => `**${o.name}**${o.hazardous ? ' ⚠️' : ''}\n> Ø ${o.diaMin}–${o.diaMax} m · ${o.velocityKmh.toLocaleString()} km/h · ${o.missLunar.toFixed(1)} LD`);
      const embed = new EmbedBuilder().setColor(haz ? 0xe74c3c : 0x3fa7ff)
        .setTitle(`☄️ Near-Earth Objects — ${data.date}`)
        .setDescription(`**${data.count}** tracked${haz ? ` · ⚠️ **${haz}** potentially hazardous` : ' · none hazardous 🟢'}\n\n${lines.join('\n\n')}`.slice(0, 4096))
        .setImage('attachment://neo.png')
        .setFooter({ text: 'NASA NeoWs · LD = Lunar Distances' });
      return { embeds: [embed], files: [new AttachmentBuilder(renderNeoCard(data), { name: 'neo.png' })] };
    },
  },
  {
    name: 'hurricane', aliases: ['storms', 'cyclone', 'tropical'], category: 'qapi',
    description: 'Active hurricanes & tropical storms (NOAA NHC)',
    async run() {
      const storms = await api.getHurricanes();
      if (!storms.length) return '🌀 **No active tropical cyclones** right now, per the National Hurricane Center. Calm seas. 🌊';
      const emoji = (c) => (/HU|HR/i.test(c) ? '🌀' : /TS/i.test(c) ? '🌩️' : /TD/i.test(c) ? '🌧️' : '🌀');
      const lines = storms.slice(0, 8).map((s) =>
        `${emoji(s.classification)} **${s.name}** — ${s.classification}${s.basin ? ` · ${s.basin}` : ''}\n> 💨 ${s.wind ?? '?'} kt · 🎯 ${s.pressure ?? '?'} mb · 📍 ${(+s.lat).toFixed(1)}, ${(+s.lon).toFixed(1)} · ➡️ ${s.movement}`);
      const embed = new EmbedBuilder().setColor(0xe74c3c)
        .setTitle(`🌀 Active Tropical Cyclones — ${storms.length}`)
        .setDescription(lines.join('\n\n').slice(0, 4096))
        .setFooter({ text: 'NOAA National Hurricane Center' });
      return { embeds: [embed] };
    },
  },
  {
    name: 'tornado', aliases: ['tornadoes', 'twarn', 'tornadowarning'], category: 'qapi',
    description: 'Active US tornado warnings (NWS)',
    async run() {
      const warns = await api.getTornadoWarnings();
      if (!warns.length) return '🌪️ **No active tornado warnings** in the US right now (NWS). Stay safe out there. 🙏';
      const lines = warns.slice(0, 8).map((w) =>
        `🌪️ **${(w.area || 'Unknown').slice(0, 120)}**\n> ${w.severity || '—'}${w.expires ? ` · expires <t:${Math.floor(new Date(w.expires).getTime() / 1000)}:R>` : ''} · ${w.sender || ''}`);
      const embed = new EmbedBuilder().setColor(0x8e44ad)
        .setTitle(`🌪️ Active Tornado Warnings — ${warns.length}`)
        .setDescription(lines.join('\n\n').slice(0, 4096))
        .setFooter({ text: 'US National Weather Service · take shelter if warned' });
      return { embeds: [embed] };
    },
  },
  {
    name: 'emojis', aliases: ['emojilist', 'listemojis'], category: 'qapi',
    description: 'Show all custom emojis in this server',
    run({ message }) {
      const all = message.guild?.emojis?.cache;
      if (!all || !all.size) return '😶 This server has no custom emojis.';
      const anim = all.filter((e) => e.animated).map((e) => e.toString());
      const still = all.filter((e) => !e.animated).map((e) => e.toString());
      let out = `😃 **${all.size} custom emoji${all.size === 1 ? '' : 's'}**\n`;
      if (still.length) out += `\n**Static (${still.length}):** ${still.join(' ')}`;
      if (anim.length) out += `\n**Animated (${anim.length}):** ${anim.join(' ')}`;
      return out.slice(0, 2000);
    },
  },
];

export default COMMANDS;
