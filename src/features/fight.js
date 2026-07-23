// !fight — an image-rendered, button-controlled battle royale (up to 12, real+AI).
// Once STARTed, every render shows 20 move buttons: punch, kick, fire gun, throw
// a Boeing 737, drop a nuke, etc. Any alive fighter clicks a move to act; the AI
// fight back. Owner secretly rigs via DM "!rigf". Arena drawn on canvas.
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { renderArena } from './fightRender.js';
import { balance, addWallet } from '../economy/store.js';

const COIN = '🪙';

const FALLBACK_OWNER = '1183222250153984040';
function isOwner(userId) {
  const ids = (process.env.OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return ids.length ? ids.includes(userId) : userId === FALLBACK_OWNER;
}

const fights = new Map();
export function getFights() { return fights; }

const MAX = 12;
const AI_NAMES = ['CPU Rex', 'Bot Vex', 'AI Nyx', 'Droid Zed', 'Mecha Kai', 'CPU Blaze', 'Bot Onyx', 'AI Sable', 'Droid Fang', 'Mecha Rune', 'CPU Ghost'];
const WEAPONS = [
  { name: 'Pistol', color: '#c0c0c0' }, { name: 'Shotgun', color: '#e67e22' }, { name: 'Sniper', color: '#e74c3c' },
  { name: 'SMG', color: '#3498db' }, { name: 'Rocket', color: '#c0392b' }, { name: 'Frying Pan', color: '#95a5a6' },
  { name: 'Banana Gun', color: '#f1c40f' }, { name: 'Laser', color: '#9b59b6' }, { name: 'Crossbow', color: '#27ae60' },
  { name: 'Grenade', color: '#d35400' }, { name: 'Minigun', color: '#2ecc71' }, { name: 'Katana', color: '#e84393' },
];
const rndW = () => WEAPONS[Math.floor(Math.random() * WEAPONS.length)];
const mk = (id, name, ai, avatar) => ({ id, name: String(name).slice(0, 24), ai: !!ai, avatar: avatar || null, weapon: rndW(), hp: 100, maxHp: 100, alive: true, rage: 0 });

// ---- combat helpers ----
const rnd = (n) => Math.floor(Math.random() * n);
const aliveEnemies = (f, a) => f.fighters.filter((x) => x.alive && x.id !== a.id);
const hasAliveReal = (f) => f.fighters.some((x) => x.alive && !x.ai);

function checkWinner(fight) {
  const left = fight.fighters.filter((f) => f.alive);
  if (left.length <= 1) { fight.over = true; fight.winner = left[0] ? left[0].name : 'Nobody'; fight.winnerId = left[0] ? left[0].id : null; fight.log.push(`🏆 ${fight.winner} is the LAST ONE STANDING!`); }
}

// Pay out / refund the pot once, when a bet fight ends.
function settle(fight) {
  if (fight.settled) return; fight.settled = true;
  if (!fight.bet) return;
  const winner = fight.fighters.find((f) => f.id === fight.winnerId);
  if (winner && !winner.ai) { addWallet(winner.id, fight.pot, 'fight-win'); fight.log.push(`💰 **${winner.name}** won the pot — ${COIN}${fight.pot.toLocaleString()}!`); }
  else { for (const id of fight.paidIds) addWallet(id, fight.bet, 'fight-refund'); fight.log.push(`💸 A bot took the win — all bets refunded (${COIN}${fight.bet.toLocaleString()} each).`); }
}
function hit(f, a, min, max, verb) {
  const e = aliveEnemies(f, a); if (!e.length) return '';
  const t = e[rnd(e.length)];
  let d = min + rnd(max - min + 1);
  if (a.rage > 0) { d = Math.floor(d * 1.5); a.rage--; }
  const crit = Math.random() < 0.15; if (crit) d = Math.floor(d * 1.6);
  t.hp -= d;
  if (t.hp <= 0) { t.hp = 0; t.alive = false; checkWinner(f); return `💀 ${a.name} ${verb || 'hit'} ${t.name} for ${d} — **ELIMINATED!**`; }
  return `${crit ? '💥 CRIT! ' : ''}${a.name} ${verb || 'hit'} ${t.name} for ${d}`;
}
function aoe(f, a, min, max, count, verb) {
  let e = aliveEnemies(f, a); if (!e.length) return '';
  e = e.sort(() => Math.random() - 0.5).slice(0, count);
  const parts = [];
  for (const t of e) { let d = min + rnd(max - min + 1); if (a.rage > 0) d = Math.floor(d * 1.5); t.hp -= d; if (t.hp <= 0) { t.hp = 0; t.alive = false; } parts.push(`${t.name}(${d})`); }
  if (a.rage > 0) a.rage--;
  checkWinner(f);
  return `💥 ${a.name} ${verb || 'blasted'} ${parts.join(', ')}`;
}
const heal = (a, n) => { a.hp = Math.min(a.maxHp, a.hp + n); };

// The 20 moves. style: 1=Primary 2=Secondary 3=Success 4=Danger.
const MOVES = [
  { key: 'jab', label: 'Jab', emoji: '👊', style: 2, act: (f, a) => hit(f, a, 3, 8, 'jabbed') },
  { key: 'punch', label: 'Punch', emoji: '🥊', style: 2, act: (f, a) => hit(f, a, 6, 14, 'punched') },
  { key: 'kick', label: 'Kick', emoji: '🦵', style: 2, act: (f, a) => hit(f, a, 8, 18, 'kicked') },
  { key: 'slap', label: 'Slap', emoji: '✋', style: 2, act: (f, a) => hit(f, a, 2, 10, 'slapped') },
  { key: 'headbutt', label: 'Headbutt', emoji: '💢', style: 2, act: (f, a) => { const l = hit(f, a, 5, 16, 'headbutted'); a.hp = Math.max(1, a.hp - 3); return l + ` _(${a.name} took 3 recoil)_`; } },
  { key: 'gun', label: 'Fire Gun', emoji: '🔫', style: 1, act: (f, a) => hit(f, a, 12, 25, `blasted with a ${a.weapon.name}`) },
  { key: 'shotgun', label: 'Shotgun', emoji: '💥', style: 1, act: (f, a) => hit(f, a, 18, 30, 'shotgunned') },
  { key: 'sniper', label: 'Sniper', emoji: '🎯', style: 1, act: (f, a) => (Math.random() < 0.2 ? `${a.name} lined up a sniper shot… and MISSED!` : hit(f, a, 25, 42, 'sniped')) },
  { key: 'uppercut', label: 'Uppercut', emoji: '⬆️', style: 1, act: (f, a) => hit(f, a, 15, 28, 'uppercut') },
  { key: 'grenade', label: 'Grenade', emoji: '💣', style: 1, act: (f, a) => aoe(f, a, 14, 26, 2, 'grenaded') },
  { key: 'rock', label: 'Throw Rock', emoji: '🪨', style: 2, act: (f, a) => hit(f, a, 8, 20, 'chucked a rock at') },
  { key: 'run', label: 'Run Away', emoji: '🏃', style: 3, act: (f, a) => { heal(a, 12); return `🏃 ${a.name} ran away and caught their breath _(+12 hp)_`; } },
  { key: 'block', label: 'Block', emoji: '🛡️', style: 3, act: (f, a) => { heal(a, 8); return `🛡️ ${a.name} braced and recovered _(+8 hp)_`; } },
  { key: 'medkit', label: 'Med Kit', emoji: '➕', style: 3, act: (f, a) => { heal(a, 25); return `➕ ${a.name} popped a med kit _(+25 hp)_`; } },
  { key: 'rage', label: 'Rage', emoji: '😤', style: 4, act: (f, a) => { a.rage = 3; return `😤 ${a.name} is **ENRAGED** — next 3 hits deal 1.5×!`; } },
  { key: 'laser', label: 'Laser', emoji: '⚡', style: 4, act: (f, a) => hit(f, a, 25, 45, 'lasered') },
  { key: '737', label: 'Throw 737', emoji: '✈️', style: 4, act: (f, a) => aoe(f, a, 40, 70, 1, '✈️ THREW A BOEING 737 at') },
  { key: 'meteor', label: 'Meteor', emoji: '☄️', style: 4, act: (f, a) => aoe(f, a, 30, 55, 3, '☄️ called a meteor down on') },
  { key: 'nuke', label: 'NUKE', emoji: '☢️', style: 4, act: (f, a) => { let n = 0; for (const t of f.fighters) if (t.alive && t.id !== a.id) { t.hp = 0; t.alive = false; n++; } checkWinner(f); return `☢️ **${a.name} DROPPED A NUKE** — ${n} fighter(s) vaporized!`; } },
  { key: 'fingerguns', label: 'Finger Guns', emoji: '😎', style: 2, act: (f, a) => { const e = aliveEnemies(f, a); if (!e.length) return ''; const t = e[rnd(e.length)]; if (Math.random() < 0.05) { t.hp = 0; t.alive = false; checkWinner(f); return `😎 ${a.name} finger-gunned ${t.name}… and **INSTANTLY KO'd them?!**`; } t.hp = Math.max(0, t.hp - 1); if (t.hp <= 0) { t.alive = false; checkWinner(f); } return `😎 ${a.name} finger-gunned ${t.name} for 1`; } },
];
const STYLE = { 1: ButtonStyle.Primary, 2: ButtonStyle.Secondary, 3: ButtonStyle.Success, 4: ButtonStyle.Danger };

function aiTurn(f) {
  for (const ai of f.fighters) {
    if (!ai.alive || f.over || !ai.ai) continue;
    const l = hit(f, ai, 8, 24, `fired a ${ai.weapon.name} at`);
    if (l) f.log.push(l);
  }
  checkWinner(f);
}
function autoResolve(f) { let g = 0; while (!f.over && g++ < 80) { for (const ai of f.fighters) { if (!ai.alive || f.over) continue; const l = hit(f, ai, 8, 24); if (l) f.log.push(l); } checkWinner(f); } }

// ---------------------------------------------------------------------------
export async function handleFightText(message) {
  const raw = (message.content || '').trim();
  if (!/^!fight\b/i.test(raw)) return false;
  const existing = fights.get(message.channel.id);
  if (existing && !existing.over) { await message.reply('⚔️ A brawl is already raging here — finish it first!').catch(() => {}); return true; }

  const tokens = raw.split(/\s+/).slice(1);
  // bet = "$500" or "bet500"; count = a plain integer. (so "$500" isn't read as count)
  let bet = 0;
  for (const t of tokens) { const m = /^\$(\d+)$/.exec(t) || /^bet(\d+)$/i.exec(t); if (m) { bet = Math.min(1_000_000, parseInt(m[1], 10)); break; } }
  const num = tokens.map((t) => (/^\d+$/.test(t) ? parseInt(t, 10) : NaN)).find((x) => !Number.isNaN(x));
  const paidIds = [];

  const host = mk(message.author.id, message.author.username, false, message.author.displayAvatarURL({ extension: 'png', size: 128 }));
  let fighters;
  if (bet > 0) {
    const bal = balance(message.author.id).wallet;
    if (bal < bet) { await message.reply(`💸 You can't afford a ${COIN}${bet.toLocaleString()} bet — your wallet has ${COIN}${bal.toLocaleString()}.`).catch(() => {}); return true; }
    addWallet(message.author.id, -bet, 'fight-bet'); paidIds.push(host.id);
    fighters = [host]; // bet fights: others pay by pressing Join (mentions are ignored)
  } else {
    const realMap = new Map();
    realMap.set(host.id, host);
    for (const u of message.mentions.users.values()) if (!u.bot && !realMap.has(u.id)) realMap.set(u.id, mk(u.id, u.username, false, u.displayAvatarURL({ extension: 'png', size: 128 })));
    fighters = [...realMap.values()];
  }
  const total = Math.min(MAX, Math.max(fighters.length, num || (fighters.length >= 2 ? fighters.length : 4)));
  let ai = 0;
  while (fighters.length < total && ai < AI_NAMES.length) fighters.push(mk('ai' + ai, AI_NAMES[ai++], true));
  if (fighters.length < 2) fighters.push(mk('ai0', AI_NAMES[0], true));

  const fight = { channelId: message.channel.id, hostId: message.author.id, fighters, started: false, round: 0, log: bet ? [`🔔 High-stakes brawl — ${COIN}${bet.toLocaleString()} per fighter!`] : ['🔔 Fighters entering the arena…'], over: false, winner: null, winnerId: null, bet, pot: bet, paidIds, settled: false, createdAt: Date.now(), msg: null };
  fights.set(message.channel.id, fight);
  fight.msg = await message.reply(await render(fight)).catch(() => null);
  return true;
}

async function render(fight) {
  if (fight.over) settle(fight); // pay out the pot exactly once
  const attachment = await renderArena(fight);
  const embed = new EmbedBuilder()
    .setColor(fight.over ? 0xffd23f : fight.started ? 0xe74c3c : 0x5865f2)
    .setTitle(fight.over ? `🏆 ${fight.winner} wins the brawl!` : fight.started ? `⚔️ Battle Royale — pick your move` : '⚔️ Battle Royale — Lobby')
    .setImage('attachment://arena.png');
  if (fight.bet) embed.addFields({ name: '💰 Stakes', value: `${COIN} **${fight.pot.toLocaleString()}** pot · ${COIN}${fight.bet.toLocaleString()} per fighter${fight.over ? '' : ' · winner takes all'}`, inline: false });
  if (fight.log.length) embed.addFields({ name: '📜 Kill feed', value: fight.log.slice(-6).join('\n').slice(0, 1024) });

  let components = [];
  if (!fight.over) {
    if (!fight.started) {
      components = [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('fight:join').setLabel('Join').setEmoji('🙋').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('fight:start').setLabel('START').setEmoji('▶️').setStyle(ButtonStyle.Success),
      )];
    } else {
      // 20 move buttons → 4 rows of 5
      for (let r = 0; r < 4; r++) {
        const row = new ActionRowBuilder();
        for (let c = 0; c < 5; c++) {
          const i = r * 5 + c; const m = MOVES[i];
          row.addComponents(new ButtonBuilder().setCustomId('fight:mv:' + i).setLabel(m.label).setEmoji(m.emoji).setStyle(STYLE[m.style]));
        }
        components.push(row);
      }
    }
  }
  return { embeds: [embed], files: [attachment], attachments: [], components };
}

// ---------------------------------------------------------------------------
export async function handleFightButton(interaction) {
  const cid = interaction.customId;
  if (!cid || !cid.startsWith('fight:')) return false;
  const fight = fights.get(interaction.channel?.id);
  if (!fight) { await interaction.reply({ content: 'That brawl has ended.', flags: MessageFlags.Ephemeral }).catch(() => {}); return true; }
  const parts = cid.split(':');
  const action = parts[1];
  const eph = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});

  if (action === 'join') {
    if (fight.started || fight.over) return void eph('The fight already started.');
    if (fight.fighters.some((f) => f.id === interaction.user.id)) return void eph("You're already in the arena!");
    if (fight.fighters.filter((f) => f.ai).length === 0 && fight.fighters.length >= MAX) return void eph('Arena is full (12).');
    // pay the buy-in first
    if (fight.bet) {
      const bal = balance(interaction.user.id).wallet;
      if (bal < fight.bet) return void eph(`💸 You need ${COIN}${fight.bet.toLocaleString()} to join — you have ${COIN}${bal.toLocaleString()}.`);
      addWallet(interaction.user.id, -fight.bet, 'fight-bet'); fight.pot += fight.bet; fight.paidIds.push(interaction.user.id);
    }
    const newF = mk(interaction.user.id, interaction.user.username, false, interaction.user.displayAvatarURL({ extension: 'png', size: 128 }));
    const aiIdx = fight.fighters.findIndex((f) => f.ai);
    if (aiIdx !== -1) fight.fighters[aiIdx] = newF; else if (fight.fighters.length < MAX) fight.fighters.push(newF);
    fight.log.push(`🙋 ${newF.name} bought in${fight.bet ? ` for ${COIN}${fight.bet.toLocaleString()}` : ''}!`);
    await interaction.deferUpdate().catch(() => {}); fight.msg = interaction.message; await interaction.editReply(await render(fight)).catch(() => {});
    return true;
  }
  if (action === 'start') {
    if (fight.started || fight.over) return void eph('Already started.');
    fight.started = true; fight.log.push('🔫 Weapons hot — pick your moves!');
    await interaction.deferUpdate().catch(() => {}); fight.msg = interaction.message; await interaction.editReply(await render(fight)).catch(() => {});
    return true;
  }

  // a move
  if (action === 'mv') {
    if (fight.over) return void eph('The brawl is over.');
    if (!fight.started) return void eph('Press ▶️ START first.');
    const actor = fight.fighters.find((f) => f.id === interaction.user.id);
    if (!actor) return void eph("You're not in this fight. Start your own with `!fight`.");
    if (!actor.alive) return void eph('💀 You’ve been KO’d — you can only watch now.');
    const move = MOVES[Number(parts[2])];
    if (!move) return void eph('Unknown move.');
    const line = move.act(fight, actor);
    if (line) fight.log.push(`▶️ ${line}`);
    if (!fight.over) aiTurn(fight);
    if (!fight.over && !hasAliveReal(fight)) autoResolve(fight); // no humans left → let AI finish
    await interaction.deferUpdate().catch(() => {});
    fight.msg = interaction.message;
    await interaction.editReply(await render(fight)).catch(() => {});
    return true;
  }
  return true;
}

// ---------------------------------------------------------------------------
// OWNER RIG — DM "!rigf"
// ---------------------------------------------------------------------------
function findOwnerFight(userId) { for (const f of fights.values()) if (!f.over && (f.fighters.some((x) => x.id === userId) || f.hostId === userId)) return f; return null; }

function rigPanel(fight, userId) {
  const me = fight.fighters.find((f) => f.id === userId);
  const embed = new EmbedBuilder().setColor(0xffd23f).setTitle('🎛️ Fight Rig Panel — Owner')
    .setDescription(
      `**Channel:** <#${fight.channelId}> · ${fight.started ? 'Fighting' : 'Lobby'}\n\n` +
      fight.fighters.map((f) => `${f.alive ? '' : '💀 '}${f.ai ? '🤖' : '🧑'} **${f.name}** — ${f.alive ? f.hp + ' hp · ' + f.weapon.name : 'KO'}${f.id === userId ? ' ← YOU' : ''}`).join('\n').slice(0, 4000),
    )
    .setFooter({ text: 'Only you see this. Changes hit the arena instantly. 👑' });
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('frig:heal').setLabel('Heal me full').setEmoji('❤️').setStyle(ButtonStyle.Success).setDisabled(!me),
        new ButtonBuilder().setCustomId('frig:smite').setLabel('Smite random enemy').setEmoji('💀').setStyle(ButtonStyle.Primary),
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('frig:god').setLabel('God gun').setEmoji('🔫').setStyle(ButtonStyle.Secondary).setDisabled(!me),
        new ButtonBuilder().setCustomId('frig:nuke').setLabel('Nuke everyone (win)').setEmoji('☢️').setStyle(ButtonStyle.Danger),
      ),
      new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('frig:refresh').setLabel('Refresh').setEmoji('♻️').setStyle(ButtonStyle.Secondary)),
    ],
  };
}
export async function openFightRig(message) {
  if (!isOwner(message.author.id)) return false;
  const fight = findOwnerFight(message.author.id);
  if (!fight) { await message.reply('⚔️ No active fight found that you’re in. Start one with `!fight`, then DM `!rigf`.').catch(() => {}); return true; }
  await message.reply(rigPanel(fight, message.author.id)).catch(() => {});
  return true;
}
export async function handleFightRigButton(interaction) {
  const cid = interaction.customId;
  if (!cid || !cid.startsWith('frig:')) return false;
  if (!isOwner(interaction.user.id)) { await interaction.reply({ content: '🔒 Owner only.', flags: MessageFlags.Ephemeral }).catch(() => {}); return true; }
  const fight = findOwnerFight(interaction.user.id);
  if (!fight) { await interaction.update({ content: '⚔️ That fight has ended.', embeds: [], components: [] }).catch(() => {}); return true; }
  const action = cid.split(':')[1];
  const me = fight.fighters.find((f) => f.id === interaction.user.id);
  if (action === 'heal' && me) { me.hp = me.maxHp; me.alive = true; fight.log.push(`👑 ${me.name} was fully restored by an unseen hand…`); }
  else if (action === 'god' && me) { me.weapon = { name: 'Hand of God', color: '#ffd23f' }; fight.log.push(`👑 ${me.name} picked up something… otherworldly.`); }
  else if (action === 'smite') { const e = fight.fighters.filter((f) => f.alive && f.id !== interaction.user.id); if (e.length) { const t = e[rnd(e.length)]; t.hp = 0; t.alive = false; fight.log.push(`👑 ${t.name} was struck down by an unseen force…`); checkWinner(fight); } }
  else if (action === 'nuke') { for (const f of fight.fighters) if (f.id !== interaction.user.id) { f.hp = 0; f.alive = false; } fight.log.push('☢️ A cataclysm swept the arena…'); checkWinner(fight); }
  await interaction.update(rigPanel(fight, interaction.user.id)).catch(() => {});
  try { if (fight.msg) await fight.msg.edit(await render(fight)); } catch { /* gone */ }
  return true;
}
