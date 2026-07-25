// ============================================================================
// SESSION SYSTEM — a "session startup" announcer for RP servers.
//   !session (or !startup / !ssu / !vote / !low / !full) [note]
// Opens a builder: pick a GAME (ER:LC, GTA V, Rust, Minecraft) and a session
// TYPE (Startup / Vote / Low on players / Full / Custom), customize it, then post.
// ER:LC pulls LIVE data if a Server-Key is provided (optional).
//
// 60 template variables ({name}) usable in the title/description:
//   • 30 that need NO API key (host, game, counts, time, custom fields…)
//   • 30 that need the ER:LC key (live players, queue, teams, join code, logs…)
// ============================================================================
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { erlcKey } from './erlc.js';

const builders = new Map(); // builderMessageId -> state

const GAMES = {
  erlc: { label: 'ER:LC', emoji: '🚓', needsKey: true, max: 40 },
  gtav: { label: 'GTA V', emoji: '🌇', needsKey: false, max: 32 },
  rust: { label: 'Rust', emoji: '🔧', needsKey: false, max: 100 },
  mc: { label: 'Minecraft', emoji: '⛏️', needsKey: false, max: 20 },
};

const TYPES = {
  startup: { label: 'Startup', emoji: '🚀', color: 0x2ecc71,
    title: '{game_emoji} {game} — SESSION STARTUP',
    desc: 'A **{game}** session is starting up! Hop in and get ready.\n\n👥 Players needed: **{needed}**\n🕐 Starts {relative}\n🎮 Mode: **{gamemode}** · 🌎 {region}\n🎟️ Session ID: `{sessionid}`\n🔑 Host: {host_mention}\n\n{note}' },
  vote: { label: 'Vote', emoji: '🗳️', color: 0x3498db,
    title: '{game_emoji} {game} — SESSION VOTE',
    desc: 'Vote to start a **{game}** session! We need **{votes}** votes to go live.\n\n✅ **React below to vote!**\n👥 Current interest builds momentum.\n🔑 Host: {host_mention}\n\n{note}' },
  low: { label: 'Low on players', emoji: '📉', color: 0xe67e22,
    title: '{game_emoji} {game} — LOW ON PLAYERS',
    desc: 'Our **{game}** session is running low — come back before it dies! 🆘\n\n👥 Need **{needed}** more to keep it alive.\n🕐 {time}\n🔑 Host: {host_mention}\n\n{note}' },
  full: { label: 'Full', emoji: '🎉', color: 0x9b59b6,
    title: '{game_emoji} {game} — SESSION FULL',
    desc: 'The **{game}** session is **FULL**! 🎉 Thanks to everyone who joined.\n\n👥 All **{maxplayers}** slots filled.\n🔑 Host: {host_mention}\n\n{note}' },
  custom: { label: 'Custom', emoji: '✏️', color: 0x5865f2,
    title: '{game_emoji} {game} — SESSION',
    desc: '{note}\n\n🔑 Host: {host_mention} · 🕐 {time}' },
};

const ALIAS_TYPE = { session: 'startup', ssu: 'startup', startup: 'startup', su: 'startup', vote: 'vote', low: 'low', lowonplayers: 'low', full: 'full' };

const rndCode = (n = 4) => Array.from({ length: n }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

// ---- ER:LC live fetch (direct, so a per-session key override works) ----
async function erlcGet(key, path) {
  try {
    const r = await fetch('https://api.policeroleplay.community/v1' + path, { headers: { 'Server-Key': key, 'Content-Type': 'application/json' } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}
async function fetchErlc(key) {
  if (!key) return null;
  const [server, players, queue, vehicles, modcalls, kills, joins, commands, bans] = await Promise.all(
    ['/server', '/server/players', '/server/queue', '/server/vehicles', '/server/modcalls', '/server/killlogs', '/server/joinlogs', '/server/commandlogs', '/server/bans'].map((p) => erlcGet(key, p)),
  );
  if (!server) return null;
  return { server, players: players || [], queue: queue || [], vehicles: vehicles || [], modcalls: modcalls || [], kills: kills || [], joins: joins || [], commands: commands || [], bans: bans || {} };
}
const teamCount = (players, ...teams) => players.filter((p) => teams.includes(p.Team)).length;

// ---- variable resolver ----
function buildVars(ctx) {
  const { guild, channel, host, game, type, ov, erlc } = ctx;
  const now = new Date();
  const unix = Math.floor(now.getTime() / 1000);
  const g = GAMES[game] || { label: game, emoji: '🎮', max: 40 };
  const t = TYPES[type] || TYPES.startup;
  const K = (v) => (erlc ? String(v) : '🔒'); // API vars show a lock without a key
  const s = erlc?.server || {};
  const pl = erlc?.players || [];
  const cur = s.CurrentPlayers ?? 0; const max = s.MaxPlayers ?? g.max;

  // 30 that need NO key
  const noKey = {
    host: () => ov.host || host.username,
    host_mention: () => `<@${host.id}>`,
    host_avatar: () => host.displayAvatarURL?.() || '',
    game: () => g.label,
    game_emoji: () => g.emoji,
    server: () => guild.name,
    members: () => String(guild.memberCount ?? 0),
    online: () => String(guild.approximatePresenceCount || guild.memberCount || 0),
    channel: () => `<#${channel.id}>`,
    date: () => now.toLocaleDateString(),
    time: () => now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    day: () => now.toLocaleDateString([], { weekday: 'long' }),
    timestamp: () => `<t:${unix}:F>`,
    relative: () => `<t:${unix}:R>`,
    sessionid: () => ctx.sessionid,
    code: () => ctx.code,
    needed: () => String(ov.needed ?? 6),
    slots: () => String(ov.needed ?? 6),
    votes: () => String(ov.votes ?? 5),
    maxplayers: () => String(ov.max ?? g.max),
    gamemode: () => ov.gamemode || 'Public',
    region: () => ov.region || 'NA-East',
    status: () => t.label,
    emoji: () => t.emoji,
    cohost: () => ov.cohost || 'None',
    duration: () => ov.duration || 'TBD',
    rules: () => ov.rules || 'Check the rules channel',
    discord: () => ov.discord || guild.name,
    reacts: () => 'React below to join!',
    note: () => ov.note || '',
  };
  // 30 that need the ER:LC key
  const keyVars = {
    live_players: () => K(cur),
    live_max: () => K(max),
    slots_left: () => K(Math.max(0, max - cur)),
    percent_full: () => K(max ? Math.round((cur / max) * 100) + '%' : '0%'),
    is_full: () => K(cur >= max ? 'YES' : 'no'),
    join_code: () => K(s.JoinKey || '—'),
    server_name: () => K(s.Name || '—'),
    owner_id: () => K(s.OwnerId || '—'),
    coowners: () => K((s.CoOwnerIds || []).length),
    team_balance: () => K(s.TeamBalance ? 'On' : 'Off'),
    verified_req: () => K(s.AccVerifiedReq || 'Disabled'),
    queue_count: () => K((erlc?.queue || []).length),
    queue_list: () => K((erlc?.queue || []).slice(0, 5).join(', ') || 'empty'),
    players_list: () => K(pl.slice(0, 6).map((p) => (p.Player || '').split(':')[0]).join(', ') || 'none'),
    first_player: () => K((pl[0]?.Player || '—').split(':')[0]),
    staff_online: () => K(pl.filter((p) => p.Permission && p.Permission !== 'Normal').length),
    cops: () => K(teamCount(pl, 'Police', 'Sheriff')),
    fire: () => K(teamCount(pl, 'Fire')),
    dot: () => K(teamCount(pl, 'DOT')),
    civs: () => K(teamCount(pl, 'Civilian')),
    jail: () => K(teamCount(pl, 'Jail')),
    vehicles: () => K((erlc?.vehicles || []).length),
    mod_calls: () => K((erlc?.modcalls || []).length),
    kills: () => K((erlc?.kills || []).length),
    join_logs: () => K((erlc?.joins || []).length),
    command_logs: () => K((erlc?.commands || []).length),
    bans: () => K(Object.keys(erlc?.bans || {}).length),
    status_live: () => K(cur > 0 ? '🟢 Live' : '🔴 Empty'),
    last_updated: () => K(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
    api_ok: () => (erlc ? '✅ connected' : '🔒 no key'),
  };
  return { ...noKey, ...keyVars };
}
export function VAR_NAMES() {
  const dummy = { guild: { name: '', memberCount: 0 }, channel: { id: '' }, host: { id: '', username: '', displayAvatarURL: () => '' }, game: 'erlc', type: 'startup', ov: {}, erlc: null, sessionid: '', code: '' };
  const v = buildVars(dummy);
  const noKeyNames = ['host', 'host_mention', 'host_avatar', 'game', 'game_emoji', 'server', 'members', 'online', 'channel', 'date', 'time', 'day', 'timestamp', 'relative', 'sessionid', 'code', 'needed', 'slots', 'votes', 'maxplayers', 'gamemode', 'region', 'status', 'emoji', 'cohost', 'duration', 'rules', 'discord', 'reacts', 'note'];
  const all = Object.keys(v);
  return { noKey: noKeyNames, key: all.filter((n) => !noKeyNames.includes(n)), total: all.length };
}
function resolve(text, vars) {
  return String(text || '').replace(/\{(\w+)\}/g, (m, name) => (vars[name] ? vars[name]() : m));
}

// ---- builder UI ----
function renderBuilder(state, client) {
  const g = GAMES[state.game];
  const t = TYPES[state.type];
  const embed = new EmbedBuilder()
    .setColor(t?.color ?? 0x5865f2)
    .setTitle('🎬 Session Studio')
    .setDescription(
      `Build your session announcement, then hit **📢 Post**.\n\n` +
      `🎮 **Game:** ${g ? `${g.emoji} ${g.label}` : '_choose below_'}\n` +
      `🏷️ **Type:** ${t ? `${t.emoji} ${t.label}` : '_choose below_'}\n` +
      `🔑 **ER:LC key:** ${state.game === 'erlc' ? (state.hasKey ? '✅ provided' : '⚠️ none (live stats off — that’s OK)') : 'n/a'}\n` +
      `${state.ov.ping ? `📣 **Ping:** ${state.ov.ping}\n` : ''}` +
      `\n💡 Use **✏️ Customize** for full creative control (title, text, ping…). **{variables}** are supported — tap **📋 Variables** to see all 60.`,
    )
    .setFooter({ text: 'Only the host can build. Selections save as you go.' });

  const gameSel = new StringSelectMenuBuilder().setCustomId('session:game').setPlaceholder('🎮 Choose a game…')
    .addOptions(Object.entries(GAMES).map(([k, v]) => ({ label: v.label, value: k, emoji: v.emoji, default: state.game === k })));
  const typeSel = new StringSelectMenuBuilder().setCustomId('session:type').setPlaceholder('🏷️ Choose a session type…')
    .addOptions(Object.entries(TYPES).map(([k, v]) => ({ label: v.label, value: k, emoji: v.emoji, default: state.type === k })));

  const rows = [
    new ActionRowBuilder().addComponents(gameSel),
    new ActionRowBuilder().addComponents(typeSel),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('session:custom').setLabel('Customize').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('session:key').setLabel('ER:LC Key').setEmoji('🔑').setStyle(ButtonStyle.Secondary).setDisabled(state.game !== 'erlc'),
      new ButtonBuilder().setCustomId('session:vars').setLabel('Variables').setEmoji('📋').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('session:post').setLabel('Post').setEmoji('📢').setStyle(ButtonStyle.Success).setDisabled(!state.game),
    ),
  ];
  return { embeds: [embed], components: rows };
}

// ---- prefix command ----
export async function handleSessionText(message) {
  const raw = (message.content || '').trim();
  const m = /^!(session|ssu|startup|su|vote|lowonplayers|low|full)\b\s*(.*)$/i.exec(raw);
  if (!m) return false;
  const type = ALIAS_TYPE[m[1].toLowerCase()] || 'startup';
  const note = (m[2] || '').trim().slice(0, 300);
  const state = { hostId: message.author.id, guildId: message.guild.id, game: null, type, ov: note ? { note } : {}, hasKey: false };
  // Preset the ER:LC key flag from guild config, if any.
  try { state.hasKey = Boolean(erlcKey(message.guild.id)); } catch { /* ignore */ }
  const msg = await message.reply(renderBuilder(state, message.client)).catch(() => null);
  if (msg) builders.set(msg.id, state);
  return true;
}

// ---- interaction handling (components + modals) ----
export async function handleSessionInteraction(interaction) {
  const cid = interaction.customId || '';
  if (!cid.startsWith('session:')) return false;
  const parts = cid.split(':');
  const action = parts[1];
  // Component interactions carry the builder message; modal submits carry the
  // builder id in the customId (parts[2]) since modals have no source message.
  const builderId = interaction.message?.id || parts[2];
  const state = builders.get(builderId);
  const eph = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});

  // Variables list works even without state.
  if (action === 'vars') {
    const { noKey, key, total } = VAR_NAMES();
    const txt = `**${total} session variables** — use like \`{host}\` in your text.\n\n` +
      `**🟢 No key needed (${noKey.length}):**\n> ${noKey.map((n) => `\`{${n}}\``).join(' ')}\n\n` +
      `**🔑 ER:LC key needed (${key.length}):**\n> ${key.map((n) => `\`{${n}}\``).join(' ')}`;
    return void interaction.reply({ content: txt.slice(0, 1900), flags: MessageFlags.Ephemeral }).catch(() => {});
  }

  if (!state) return void eph('⏳ This builder expired (the bot restarted). Run `!session` again.');
  if (interaction.user.id !== state.hostId && action !== 'vars') return void eph('🔒 Only the host who ran the command can build this session.');

  if (action === 'game') { state.game = interaction.values[0]; await interaction.update(renderBuilder(state, interaction.client)).catch(() => {}); return true; }
  if (action === 'type') { state.type = interaction.values[0]; await interaction.update(renderBuilder(state, interaction.client)).catch(() => {}); return true; }

  if (action === 'key') {
    state.msgRef = interaction.message;
    const modal = new ModalBuilder().setCustomId('session:keymodal:' + interaction.message.id).setTitle('ER:LC Server Key');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('key').setLabel('Server-Key (leave blank to skip)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(120)));
    return void interaction.showModal(modal).catch(() => {});
  }
  if (action === 'keymodal') {
    const k = (interaction.fields.getTextInputValue('key') || '').trim();
    state.erlcKey = k || null; state.hasKey = Boolean(k);
    await interaction.reply({ content: k ? '🔑 Key saved for this session — live ER:LC stats enabled.' : 'No key set — that’s fine, live stats stay off.', flags: MessageFlags.Ephemeral }).catch(() => {});
    if (state.msgRef) await state.msgRef.edit(renderBuilder(state, interaction.client)).catch(() => {});
    else await interaction.message?.edit?.(renderBuilder(state, interaction.client)).catch(() => {});
    return true;
  }

  if (action === 'custom') {
    state.msgRef = interaction.message;
    const t = TYPES[state.type] || TYPES.startup;
    const modal = new ModalBuilder().setCustomId('session:custommodal:' + interaction.message.id).setTitle('Customize Session');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Title (variables ok)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(200).setValue(state.ov.title || t.title)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('desc').setLabel('Description (variables ok)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1500).setValue(state.ov.desc || t.desc)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ping').setLabel('Ping (e.g. @role or a role mention)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(120).setValue(state.ov.ping || '')),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('needed').setLabel('Players needed').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(4).setValue(String(state.ov.needed ?? ''))),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('note').setLabel('Extra note / message').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(400).setValue(state.ov.note || '')),
    );
    return void interaction.showModal(modal).catch(() => {});
  }
  if (action === 'custommodal') {
    const f = interaction.fields;
    state.ov.title = f.getTextInputValue('title').trim() || undefined;
    state.ov.desc = f.getTextInputValue('desc').trim() || undefined;
    state.ov.ping = f.getTextInputValue('ping').trim() || undefined;
    const need = parseInt(f.getTextInputValue('needed').replace(/[^0-9]/g, ''), 10);
    if (!Number.isNaN(need)) state.ov.needed = need;
    state.ov.note = f.getTextInputValue('note').trim() || undefined;
    await interaction.reply({ content: '✅ Customizations saved.', flags: MessageFlags.Ephemeral }).catch(() => {});
    if (state.msgRef) await state.msgRef.edit(renderBuilder(state, interaction.client)).catch(() => {});
    return true;
  }

  if (action === 'post') {
    if (!state.game) return void eph('Pick a game first.');
    await interaction.deferUpdate().catch(() => {});
    const g = GAMES[state.game];
    const t = TYPES[state.type] || TYPES.startup;
    // Live ER:LC data (per-session key, else guild-configured key).
    let erlc = null;
    if (state.game === 'erlc') {
      const key = state.erlcKey || (() => { try { return erlcKey(interaction.guild.id); } catch { return null; } })();
      if (key) erlc = await fetchErlc(key);
    }
    const ctx = { guild: interaction.guild, channel: interaction.channel, host: interaction.user, game: state.game, type: state.type, ov: state.ov, erlc, sessionid: rndCode(6), code: rndCode(4) };
    const vars = buildVars(ctx);
    const title = resolve(state.ov.title || t.title, vars).slice(0, 256);
    const desc = resolve(state.ov.desc || t.desc, vars).slice(0, 4000);

    const embed = new EmbedBuilder().setColor(t.color).setTitle(title).setDescription(desc)
      .setThumbnail(interaction.guild.iconURL?.() || null)
      .setFooter({ text: `${g.label} • ${t.label} session • hosted by ${interaction.user.username}` })
      .setTimestamp();
    if (erlc) embed.addFields({ name: '📡 Live ER:LC', value: resolve('👥 {live_players}/{live_max} · queue {queue_count} · {status_live} · code `{join_code}`', vars) });

    const content = state.ov.ping ? resolve(state.ov.ping, vars) : undefined;
    // Only allow @everyone/@here if the host actually has that permission.
    const canEveryone = interaction.member?.permissions?.has(PermissionFlagsBits.MentionEveryone);
    const parse = canEveryone ? ['roles', 'users', 'everyone'] : ['roles', 'users'];
    const posted = await interaction.channel.send({ content, embeds: [embed], allowedMentions: { parse } }).catch(() => null);
    if (posted && state.type === 'vote') { await posted.react('✅').catch(() => {}); await posted.react('❌').catch(() => {}); }

    builders.delete(interaction.message.id);
    await interaction.editReply({ content: '📢 **Session posted!**', embeds: [], components: [] }).catch(() => {});
    return true;
  }
  return true;
}
