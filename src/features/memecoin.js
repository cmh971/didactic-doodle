// Memecoin Analyzer — watches freshly-listed tokens on DexScreener's free public
// API and fires a Discord alert the moment a coin clears your quality filters
// (liquidity, 24h volume, age, momentum). Deduped so the same coin never alerts
// twice, even across restarts.
//
// Honest framing baked into every alert: memecoins are extremely high risk and
// most go to zero. These filters surface *activity*, not a guaranteed winner —
// the embed says so out loud. Not financial advice.
//
// Data feed (no key required):
//   GET https://api.dexscreener.com/token-profiles/latest/v1   -> [{chainId, tokenAddress}]
//   GET https://api.dexscreener.com/latest/dex/tokens/{addr}    -> { pairs:[{ baseToken, liquidity.usd, volume, priceChange, pairCreatedAt, fdv, marketCap, url }] }
import { EmbedBuilder } from 'discord.js';
import { getDb } from '../db/index.js';
import { getCfg, setNested } from '../setup/store.js';

const PROFILES_URL = 'https://api.dexscreener.com/token-profiles/latest/v1';
const TOKEN_URL = (addr) => `https://api.dexscreener.com/latest/dex/tokens/${addr}`;

const DEFAULTS = {
  enabled: false,
  channel: null,        // channel id for alerts (falls back to logChannel)
  chains: ['solana'],   // which chains to watch
  minLiq: 10000,        // min USD liquidity
  minVol: 30000,        // min 24h USD volume
  maxAgeH: 72,          // only coins created within this many hours
  minChange: -100,      // min 24h % change (-100 = off)
  perCycle: 5,          // max alerts per guild per cycle (anti-flood)
};

const db = getDb();
db.exec(`CREATE TABLE IF NOT EXISTS coin_seen (
  guild_id TEXT NOT NULL,
  token    TEXT NOT NULL,
  ts       INTEGER NOT NULL,
  PRIMARY KEY (guild_id, token)
)`);
const seenStmt = {
  has: db.prepare('SELECT 1 FROM coin_seen WHERE guild_id=? AND token=?'),
  add: db.prepare('INSERT OR IGNORE INTO coin_seen(guild_id,token,ts) VALUES (?,?,?)'),
  prune: db.prepare('DELETE FROM coin_seen WHERE ts < ?'),
};

export function getCoinCfg(guildId) {
  return { ...DEFAULTS, ...(getCfg(guildId).settings.coinwatch || {}) };
}
export function setCoinCfg(guildId, key, val) { return setNested(guildId, 'coinwatch', key, val); }

// ---- fetch helper (timeout + soft-fail) ----
async function fetchJson(url, ms = 8000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { signal: ac.signal, headers: { accept: 'application/json' } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// Turn one {chainId, tokenAddress} profile into a full candidate (or null).
async function enrich(chainId, addr) {
  const j = await fetchJson(TOKEN_URL(addr));
  const pairs = Array.isArray(j?.pairs) ? j.pairs : [];
  if (!pairs.length) return null;
  const chain = String(chainId || '').toLowerCase();
  const onChain = pairs.filter((p) => String(p.chainId || '').toLowerCase() === chain);
  const p = (onChain.length ? onChain : pairs).sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
  if (!p) return null;
  const created = Number(p.pairCreatedAt) || 0;
  return {
    chain,
    address: addr,
    symbol: p.baseToken?.symbol || '?',
    name: p.baseToken?.name || p.baseToken?.symbol || 'Unknown',
    priceUsd: Number(p.priceUsd) || 0,
    liq: Number(p.liquidity?.usd) || 0,
    vol24: Number(p.volume?.h24) || 0,
    vol6: Number(p.volume?.h6) || 0,
    chg24: Number(p.priceChange?.h24) || 0,
    chg6: Number(p.priceChange?.h6) || 0,
    ageH: created ? (Date.now() - created) / 3.6e6 : Infinity,
    fdv: Number(p.fdv) || 0,
    mc: Number(p.marketCap) || 0,
    url: p.url || `https://dexscreener.com/${chain}/${addr}`,
  };
}

function passes(cfg, c) {
  if (!c) return false;
  if (!cfg.chains.map((x) => x.toLowerCase()).includes(c.chain)) return false;
  if (c.liq < cfg.minLiq) return false;
  if (c.vol24 < cfg.minVol) return false;
  if (c.ageH > cfg.maxAgeH) return false;
  if (c.chg24 < cfg.minChange) return false;
  return true;
}

// A light "activity score" purely for display flair — NOT a prediction.
function score(c) {
  return Math.round(Math.log10(c.liq + 1) * 10 + Math.log10(c.vol24 + 1) * 12 + Math.max(0, c.chg24) * 0.5);
}

const money = (n) => (n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? '$' + (n / 1e3).toFixed(1) + 'K' : '$' + n.toFixed(0));
const price = (n) => (n === 0 ? '?' : n < 0.001 ? '$' + n.toExponential(2) : '$' + n.toPrecision(4));

function buildEmbed(c) {
  const up = c.chg24 >= 0;
  return new EmbedBuilder()
    .setColor(up ? 0x22c55e : 0xef4444)
    .setTitle(`${up ? '🟢' : '🔴'} ${c.name} ($${c.symbol})`)
    .setURL(c.url)
    .setDescription(`A coin just cleared your filters on **${c.chain}**.`)
    .addFields(
      { name: '💧 Liquidity', value: money(c.liq), inline: true },
      { name: '📊 24h Volume', value: money(c.vol24), inline: true },
      { name: '📈 24h Change', value: (up ? '+' : '') + c.chg24.toFixed(1) + '%', inline: true },
      { name: '💵 Price', value: price(c.priceUsd), inline: true },
      { name: '🏦 FDV', value: c.fdv ? money(c.fdv) : '—', inline: true },
      { name: '⏱️ Age', value: c.ageH < 1 ? Math.round(c.ageH * 60) + 'm' : c.ageH.toFixed(1) + 'h', inline: true },
      { name: '🔥 Activity score', value: String(score(c)), inline: true },
      { name: '🔗 Contract', value: '`' + c.address + '`', inline: false },
    )
    .setFooter({ text: '⚠️ Extremely high risk — most memecoins go to zero. Not financial advice. DYOR.' })
    .setTimestamp();
}

// Fetch the shared feed once, enrich every token whose chain any guild wants.
async function buildCandidates(wantedChains) {
  const feed = await fetchJson(PROFILES_URL);
  const list = Array.isArray(feed) ? feed : (feed?.data || []);
  const out = [];
  for (const item of list) {
    const chain = String(item.chainId || '').toLowerCase();
    const addr = item.tokenAddress || item.address;
    if (!addr || !wantedChains.has(chain)) continue;
    const c = await enrich(chain, addr);
    if (c) out.push(c);
  }
  return out;
}

// Evaluate one guild's config against the candidate list; alert + mark seen.
async function alertGuild(client, guildId, cfg, candidates, { dryRun = false } = {}) {
  const hits = candidates
    .filter((c) => passes(cfg, c))
    .filter((c) => dryRun || !seenStmt.has.get(guildId, c.address))
    .sort((a, b) => score(b) - score(a));

  if (dryRun) return { matched: hits.length, top: hits[0] || null };

  const fresh = hits.slice(0, cfg.perCycle);
  if (!fresh.length) return { matched: 0, top: null };

  const chanId = cfg.channel || getCfg(guildId).settings.logChannel;
  const channel = chanId ? await client.channels.fetch(chanId).catch(() => null) : null;
  const now = Date.now();
  let sent = 0;
  for (const c of fresh) {
    if (channel?.isTextBased()) {
      await channel.send({ embeds: [buildEmbed(c)] }).catch(() => {});
      sent++;
    }
    seenStmt.add.run(guildId, c.address, now); // mark seen even if no channel, so we don't backlog
  }
  return { matched: fresh.length, sent };
}

// Manual one-shot for the `!coinwatch test` command.
export async function runCoinTest(client, guildId) {
  const cfg = getCoinCfg(guildId);
  const wanted = new Set(cfg.chains.map((x) => x.toLowerCase()));
  const candidates = await buildCandidates(wanted);
  const res = await alertGuild(client, guildId, cfg, candidates, { dryRun: true });
  return { scanned: candidates.length, ...res };
}

let timer = null;
export function startCoinEngine(client, intervalMs = 90000) {
  if (timer) return;
  const tick = async () => {
    try {
      seenStmt.prune.run(Date.now() - 14 * 864e5); // forget coins older than 14 days
      const guilds = [];
      for (const gid of client.guilds.cache.keys()) {
        const cfg = getCoinCfg(gid);
        if (cfg.enabled) guilds.push([gid, cfg]);
      }
      if (!guilds.length) return;
      const wanted = new Set();
      for (const [, cfg] of guilds) for (const ch of cfg.chains) wanted.add(ch.toLowerCase());
      const candidates = await buildCandidates(wanted);
      for (const [gid, cfg] of guilds) {
        try { await alertGuild(client, gid, cfg, candidates); } catch (e) { console.error('coinwatch', gid, e.message); }
      }
    } catch (e) {
      console.error('coinwatch tick', e.message);
    }
  };
  timer = setInterval(tick, intervalMs);
  console.log('🪙 Memecoin analyzer started (' + intervalMs / 1000 + 's).');
}

// ---- !coinwatch command ----
const HELP = [
  '🪙 **Memecoin Analyzer** — alerts when a coin clears your filters.',
  '`!coinwatch` — show status',
  '`!coinwatch on` / `off` — enable/disable',
  '`!coinwatch here` — send alerts to this channel',
  '`!coinwatch chains solana,base` — chains to watch',
  '`!coinwatch minliq 10000` — min liquidity ($)',
  '`!coinwatch minvol 30000` — min 24h volume ($)',
  '`!coinwatch maxage 72` — max coin age (hours)',
  '`!coinwatch minchange 0` — min 24h % change',
  '`!coinwatch test` — scan right now (dry run, no alerts sent)',
].join('\n');

export async function handleCoinWatchCommand(message) {
  const m = /^!coinwatch\b\s*(\w*)\s*(.*)$/i.exec((message.content || '').trim());
  if (!m || !message.guild) return false;
  if (!message.member?.permissions?.has('ManageGuild')) { await message.reply('🔒 Needs **Manage Server**.').catch(() => {}); return true; }
  const gid = message.guild.id;
  const sub = (m[1] || '').toLowerCase();
  const arg = (m[2] || '').trim();
  const cfg = getCoinCfg(gid);
  const reply = (s) => message.reply(s).catch(() => {});

  if (!sub) {
    return reply([
      `🪙 **Coin Watch** — ${cfg.enabled ? '🟢 ON' : '⚫ OFF'}`,
      `Alerts → ${cfg.channel ? `<#${cfg.channel}>` : (getCfg(gid).settings.logChannel ? `<#${getCfg(gid).settings.logChannel}> (log channel)` : '❌ none set — use `!coinwatch here`')}`,
      `Chains: **${cfg.chains.join(', ')}**`,
      `Filters: liq ≥ ${money(cfg.minLiq)} · vol ≥ ${money(cfg.minVol)} · age ≤ ${cfg.maxAgeH}h · 24h ≥ ${cfg.minChange}%`,
      '',
      HELP,
    ].join('\n'));
  }
  if (sub === 'help') return reply(HELP);
  if (sub === 'on') { setCoinCfg(gid, 'enabled', true); return reply('🟢 Coin Watch **ON**. I’ll alert when a coin clears your filters.\n⚠️ Reminder: memecoins are extremely high risk — this finds activity, not guaranteed wins.'); }
  if (sub === 'off') { setCoinCfg(gid, 'enabled', false); return reply('⚫ Coin Watch **OFF**.'); }
  if (sub === 'here') { setCoinCfg(gid, 'channel', message.channel.id); return reply(`✅ Alerts will post in <#${message.channel.id}>.`); }
  if (sub === 'chains') {
    const list = arg.split(/[\s,]+/).map((x) => x.toLowerCase()).filter(Boolean);
    if (!list.length) return reply('Usage: `!coinwatch chains solana,base,ethereum`');
    setCoinCfg(gid, 'chains', list);
    return reply(`✅ Watching chains: **${list.join(', ')}**`);
  }
  const numSubs = { minliq: 'minLiq', minvol: 'minVol', maxage: 'maxAgeH', minchange: 'minChange' };
  if (numSubs[sub]) {
    const n = Number(arg.replace(/[^0-9.-]/g, ''));
    if (!Number.isFinite(n)) return reply(`Usage: \`!coinwatch ${sub} <number>\``);
    setCoinCfg(gid, numSubs[sub], n);
    return reply(`✅ Set **${sub}** = ${n}`);
  }
  if (sub === 'test') {
    await reply('🔎 Scanning the latest listings…');
    const r = await runCoinTest(message.client, gid);
    if (!r.scanned) return reply('⚠️ Feed returned nothing right now (API hiccup) — try again in a moment.');
    if (!r.matched) return reply(`Scanned **${r.scanned}** fresh listings — **0** cleared your filters right now. That’s normal; loosen filters (e.g. \`!coinwatch minvol 10000\`) to see more.`);
    const c = r.top;
    return message.reply({ content: `✅ Scanned **${r.scanned}** listings — **${r.matched}** would alert. Top candidate:`, embeds: [buildEmbed(c)] }).catch(() => {});
  }
  return reply(HELP);
}
