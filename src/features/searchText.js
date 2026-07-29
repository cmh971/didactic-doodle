// !search <query> — Google-style search you browse INSIDE Discord. Aggregates
// all active engines, shows paginated results, and lets you READ a result's page
// text right in the embed (◀ ▶), never leaving Discord. Add paid/keyed engines
// by DMing the bot a key (encrypted). Interactions are native (no polling).
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { searchAll, activeEngines, keyMask, setSearchKey, KEYED_ENGINES, fetchReadable } from './search.js';

const PER_PAGE = 3;
const sessions = new Map(); // messageId -> session
const FALLBACK_OWNER = '1183222250153984040';
const isOwner = (id) => { const ids = (process.env.OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean); return ids.length ? ids.includes(id) : id === FALLBACK_OWNER; };
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

function listPayload(s) {
  const pages = Math.max(1, Math.ceil(s.results.length / PER_PAGE));
  s.page = Math.max(0, Math.min(pages - 1, s.page));
  const start = s.page * PER_PAGE;
  const slice = s.results.slice(start, start + PER_PAGE);
  const embed = new EmbedBuilder()
    .setColor(0x4285f4)
    .setTitle(`🔎 ${s.query}`.slice(0, 250))
    .setDescription(slice.map((r, i) => `**${start + i + 1}. ${r.title}**\n${(r.snippet || '').slice(0, 150) || '_no snippet_'}\n\`${r.source}\` · ${host(r.url)}`).join('\n\n').slice(0, 4000))
    .setFooter({ text: `Page ${s.page + 1}/${pages} · ${s.results.length} results · 📖 Read a result right here — you never leave Discord` });
  const nav = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('search:prev').setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(s.page <= 0),
    new ButtonBuilder().setCustomId('search:pg').setLabel(`${s.page + 1}/${pages}`).setStyle(ButtonStyle.Primary).setDisabled(true),
    new ButtonBuilder().setCustomId('search:next').setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(s.page >= pages - 1),
  );
  const reads = new ActionRowBuilder().addComponents(
    ...slice.map((r, i) => new ButtonBuilder().setCustomId('search:read:' + (start + i)).setLabel('📖 ' + (start + i + 1)).setStyle(ButtonStyle.Success)),
  );
  return { embeds: [embed], components: [nav, reads] };
}

function readPayload(s) {
  const r = s.results[s.readIdx];
  const chunks = s.readChunks;
  s.readPage = Math.max(0, Math.min(chunks.length - 1, s.readPage));
  const embed = new EmbedBuilder()
    .setColor(0x34a853)
    .setTitle(`📖 ${r.title}`.slice(0, 250))
    .setDescription('```\n' + (chunks[s.readPage] || '(empty)').slice(0, 1500) + '\n```')
    .setFooter({ text: `Text ${s.readPage + 1}/${chunks.length} · ${r.source} · ${host(r.url)}` });
  const nav = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('search:tprev').setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(s.readPage <= 0),
    new ButtonBuilder().setCustomId('search:tpg').setLabel(`${s.readPage + 1}/${chunks.length}`).setStyle(ButtonStyle.Primary).setDisabled(true),
    new ButtonBuilder().setCustomId('search:tnext').setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(s.readPage >= chunks.length - 1),
  );
  const actions = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('search:back').setLabel('Back to results').setEmoji('🔙').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Open in browser').setEmoji('🌐').setURL(r.url),
  );
  return { embeds: [embed], components: [nav, actions] };
}

export async function handleSearchText(message) {
  const m = /^!(search|google|ddg|web)\b\s*([\s\S]*)$/i.exec((message.content || '').trim());
  if (!m) return false;
  const rest = (m[2] || '').trim();

  if (/^engines?$|^sources?$/i.test(rest)) {
    const a = activeEngines();
    const keyed = KEYED_ENGINES.map((e) => `${a.keyed.includes(e) ? '✅' : '⬜'} ${e}${keyMask(e) ? ` (\`${keyMask(e)}\`)` : ''}`).join('\n');
    await message.reply(`🔎 **Active engines**\n🟢 Always on: ${a.keyless.join(', ')}\n\n**Keyed (DM me to enable):**\n${keyed}`).catch(() => {});
    return true;
  }
  if (/^key\b/i.test(rest)) {
    await message.reply('🔐 **Never post API keys in a channel.** DM me instead:\n`!search key google <APIKEY>|<CX>` · `!search key bing <KEY>` · `!search key brave <KEY>` · `!search key serpapi <KEY>`\nStored with AES-256-GCM + HMAC encryption.').catch(() => {});
    return true;
  }
  if (!rest) { await message.reply('🔎 **!search <query>** — searches all engines and lets you browse the results (and read the pages) right here in Discord.').catch(() => {}); return true; }

  const status = await message.reply('🔎 Searching all engines…').catch(() => null);
  let results;
  try { results = await searchAll(rest); } catch (e) { await status?.edit('⚠️ Search failed: ' + e.message).catch(() => {}); return true; }
  if (!results.length) { await status?.edit(`🔎 No results for **${rest}**.`).catch(() => {}); return true; }
  const s = { query: rest, results, page: 0, mode: 'list', hostId: message.author.id, at: Date.now() };
  await status?.edit(listPayload(s)).catch(() => {});
  if (status) { sessions.set(status.id, s); if (sessions.size > 60) { const oldest = [...sessions.entries()].sort((a, b) => a[1].at - b[1].at)[0]; if (oldest) sessions.delete(oldest[0]); } }
  return true;
}

// DM-only, owner-only key management. Called from the DM branch in index.js.
export async function handleSearchDM(message) {
  const m = /^!(search|google)\s+key\s+(\w+)\s*([\s\S]*)$/i.exec((message.content || '').trim());
  if (!m) return false;
  if (!isOwner(message.author.id)) { await message.reply('🔒 Owner only.').catch(() => {}); return true; }
  const engine = m[2].toLowerCase();
  const rest = (m[3] || '').trim();
  if (engine === 'remove' || engine === 'delete') {
    const target = rest.toLowerCase();
    setSearchKey(target, null);
    await message.reply(`🗑️ Removed the **${target}** key.`).catch(() => {});
    return true;
  }
  if (!KEYED_ENGINES.includes(engine)) { await message.reply(`❓ Unknown engine. One of: ${KEYED_ENGINES.join(', ')}`).catch(() => {}); return true; }
  if (!rest) { await message.reply('❌ Provide the key. e.g. `!search key google <APIKEY>|<CX>`').catch(() => {}); return true; }
  const value = engine === 'google' && !rest.includes('|') ? rest.replace(/\s+/, '|') : rest; // google needs APIKEY|CX
  setSearchKey(engine, value);
  await message.reply(`🔐 Saved **${engine}** key (encrypted): \`${keyMask(engine)}\`. It’s now active in searches.`).catch(() => {});
  return true;
}

export async function handleSearchButton(interaction) {
  if (!interaction.customId?.startsWith('search:')) return false;
  const s = sessions.get(interaction.message.id);
  if (!s) { await interaction.reply({ content: '⏳ This search expired (bot restarted). Run `!search` again.', flags: MessageFlags.Ephemeral }).catch(() => {}); return true; }
  if (interaction.user.id !== s.hostId) { await interaction.reply({ content: '🔒 Only the person who searched can browse this.', flags: MessageFlags.Ephemeral }).catch(() => {}); return true; }
  const act = interaction.customId.split(':')[1];
  s.at = Date.now();

  if (act === 'read') {
    const idx = Number(interaction.customId.split(':')[2]);
    await interaction.deferUpdate().catch(() => {});
    s.readIdx = idx; s.readPage = 0;
    const text = await fetchReadable(s.results[idx].url);
    s.readChunks = []; for (let i = 0; i < text.length; i += 1200) s.readChunks.push(text.slice(i, i + 1200));
    if (!s.readChunks.length) s.readChunks = ['(no readable text)'];
    s.mode = 'read';
    await interaction.editReply(readPayload(s)).catch(() => {});
    return true;
  }
  if (act === 'prev') s.page--;
  else if (act === 'next') s.page++;
  else if (act === 'back') s.mode = 'list';
  else if (act === 'tprev') s.readPage--;
  else if (act === 'tnext') s.readPage++;
  await interaction.update(s.mode === 'read' ? readPayload(s) : listPayload(s)).catch(() => {});
  return true;
}
