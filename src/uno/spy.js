// UNO live spy + command bridge.
//   • Writes data/uno-live.json every few seconds: full table state, EVERY
//     player's hand, whose turn, top card, AND recent channel chat (trash talk).
//   • Drains data/uno-outbox.json: an outside observer can queue a message and
//     the bot will post it into the game channel (so Claude can speak AS the bot).
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { gameManager } from './GameManager.js';
import { cardLabel } from './Deck.js';
import { renderPanel } from '../setup/ui.js';
import { getFights } from '../features/fight.js';

const DATA_DIR = join(process.cwd(), 'data');
const LIVE = join(DATA_DIR, 'uno-live.json');
const OUTBOX = join(DATA_DIR, 'uno-outbox.json');
const INSIGHT = join(DATA_DIR, 'insight.json');

// ---- live channel chat capture (last messages per active game channel) ----
const chatLog = new Map(); // channelId -> [{ u, t, at }]
export function recordUnoChat(message) {
  try {
    if (!message.guild || !gameManager.get(message.channel.id)) return; // only channels with a live game
    const buf = chatLog.get(message.channel.id) || [];
    buf.push({ u: message.author.username, t: (message.content || '').slice(0, 300), at: new Date().toISOString() });
    while (buf.length > 20) buf.shift();
    chatLog.set(message.channel.id, buf);
  } catch { /* never break the message pipeline */ }
}

function snapshot() {
  const games = [];
  for (const game of gameManager.games.values()) {
    const players = game.players
      .map((p) => ({
        username: p.username,
        id: p.id,
        cards: p.hand.length,
        hand: p.hand.map((c) => cardLabel(game.face(c))), // full hand — total insight
      }))
      .sort((a, b) => a.cards - b.cards);
    const leader = players[0] || null;
    games.push({
      channelId: game.channelId,
      mode: game.mode,
      started: game.started,
      finished: game.finished,
      winner: game.winnerId ? (game.getPlayer(game.winnerId)?.username || game.winnerId) : null,
      turn: game.currentPlayer ? game.currentPlayer.username : null,
      topCard: game.topCard ? cardLabel(game.face(game.topCard)) : null,
      currentColor: game.currentColor,
      pendingDraw: game.pendingDraw,
      standings: players,
      winning: leader ? `${leader.username} — ${leader.cards} card${leader.cards === 1 ? '' : 's'}` : null,
      lastAction: game.lastAction,
      chat: chatLog.get(game.channelId) || [],
    });
  }
  const fights = [];
  try {
    for (const f of getFights().values()) {
      fights.push({
        channelId: f.channelId, round: f.round, over: f.over, winner: f.winner,
        fighters: f.fighters.map((x) => ({ name: x.name, ai: x.ai, hp: x.hp, alive: x.alive })),
        log: f.log.slice(-6),
      });
    }
  } catch { /* fights module not ready */ }

  return { updatedAt: new Date().toISOString(), activeGames: games.length, games, fights };
}

// Send any queued outbox messages as the bot, then clear the queue.
async function drainOutbox(client) {
  if (!client || !existsSync(OUTBOX)) return;
  let queue = [];
  try { queue = JSON.parse(readFileSync(OUTBOX, 'utf8')); } catch { return; }
  if (!Array.isArray(queue) || !queue.length) return;
  writeFileSync(OUTBOX, '[]'); // clear first so we never double-send
  for (const item of queue) {
    try {
      const ch = await client.channels.fetch(item.channelId);
      if (!ch?.isTextBased?.()) continue;
      if (item.type === 'setup') {
        // VIEW-ONLY setup panel — embeds only, no interactive buttons/menus.
        const gid = ch.guild?.id;
        if (gid) { const panel = renderPanel(client, gid, Number(item.page) || 0); await ch.send({ embeds: panel.embeds }); }
      } else if (item.text) {
        await ch.send(String(item.text).slice(0, 2000));
      }
    } catch { /* channel gone / no perms */ }
  }
}

// READ-ONLY insight snapshot: bot health + who's online per guild. No side
// effects — just a file an observer can read. Written less often than the game.
function writeInsight(client) {
  if (!client) return;
  try {
    const guilds = [...client.guilds.cache.values()].map((g) => ({
      id: g.id,
      name: g.name,
      members: g.memberCount,
      online: [...g.members.cache.values()]
        .filter((m) => m.presence && m.presence.status && m.presence.status !== 'offline' && !m.user.bot)
        .slice(0, 60)
        .map((m) => ({ name: m.user.username, status: m.presence.status })),
    }));
    const mem = process.memoryUsage();
    const data = {
      updatedAt: new Date().toISOString(),
      bot: { ready: Boolean(client.isReady?.()), wsPing: Math.round(client.ws.ping), guilds: client.guilds.cache.size, users: client.users.cache.size, rssMB: Math.round(mem.rss / 1048576), uptimeSec: Math.round(process.uptime()) },
      note: guilds.every((g) => !g.online.length) ? 'online lists may be empty unless the GuildPresences intent is enabled' : undefined,
      guilds,
    };
    writeFileSync(INSIGHT, JSON.stringify(data, null, 2));
  } catch { /* ignore */ }
}

let timer = null;
let tickN = 0;
export function startUnoSpy(client, intervalMs = 3000) {
  try { mkdirSync(DATA_DIR, { recursive: true }); } catch { /* exists */ }
  const tick = () => {
    try { writeFileSync(LIVE, JSON.stringify(snapshot(), null, 2)); } catch { /* ignore */ }
    drainOutbox(client);
    if (tickN++ % 4 === 0) writeInsight(client); // ~every 12s: read-only insight
    // NOTE: no autonomous command *executor* on the timer — the bot only writes
    // read-only snapshots and posts messages YOU explicitly queued. Any real
    // action (deploy, diagnose-that-changes-things) stays human-triggered.
  };
  tick();
  if (timer) clearInterval(timer);
  timer = setInterval(tick, intervalMs);
  if (timer.unref) timer.unref();
  return LIVE;
}
