// !server — lightweight server admin from chat: view the bot's configuration,
// list channels, and create channels/categories. Mirrors the !fight / !setup
// prefix style. Gated by Manage Server (view) / Manage Channels (create), with
// an owner bypass.
//   !server config                       → modules + settings overview
//   !server channels                     → all channels grouped by category
//   !server newchannel <name> [type] [category]
//   !server newcategory <name>
import { EmbedBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { getCfg } from '../setup/store.js';
import { getGuild } from '../systems/guilds.js';

const FALLBACK_OWNER = '1183222250153984040';
function isOwner(id) {
  const ids = (process.env.OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return ids.length ? ids.includes(id) : id === FALLBACK_OWNER;
}
const can = (member, perm) => isOwner(member.id) || member.permissions?.has(perm);

const TYPE_ICON = {
  [ChannelType.GuildText]: '#️⃣', [ChannelType.GuildVoice]: '🔊', [ChannelType.GuildCategory]: '📁',
  [ChannelType.GuildAnnouncement]: '📢', [ChannelType.GuildForum]: '🧵', [ChannelType.GuildStageVoice]: '🎙️',
};
const NEW_TYPES = {
  text: ChannelType.GuildText, voice: ChannelType.GuildVoice, category: ChannelType.GuildCategory,
  announcement: ChannelType.GuildAnnouncement, news: ChannelType.GuildAnnouncement, forum: ChannelType.GuildForum, stage: ChannelType.GuildStageVoice,
};

const HELP =
  '🛠️ **!server hub**\n' +
  '• `!server config` — see modules + configured settings\n' +
  '• `!server channels` — list every channel by category\n' +
  '• `!server newchannel <name> [text|voice|announcement|forum] [category name]`\n' +
  '• `!server newcategory <name>`\n' +
  'Run `!setup` for the full visual configurator.';

// Render a setting value nicely (snowflakes → mentions, bools → on/off).
function fmtVal(guild, v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'boolean') return v ? 'on' : 'off';
  if (Array.isArray(v)) return v.length ? v.map((x) => fmtVal(guild, x)).filter(Boolean).join(', ') : null;
  const s = String(v);
  if (/^\d{17,20}$/.test(s)) {
    if (guild.channels.cache.has(s)) return `<#${s}>`;
    if (guild.roles.cache.has(s)) return `<@&${s}>`;
    return `\`${s}\``;
  }
  return s.length > 60 ? s.slice(0, 57) + '…' : s;
}

function configEmbed(guild) {
  const cfg = getCfg(guild.id);
  const g = getGuild(guild.id);
  const modules = Object.entries(g.modules || {}).map(([k, v]) => `${v !== false ? '✅' : '❌'} ${k}`).join('   ') || '—';
  const lines = [];
  for (const [group, val] of Object.entries(cfg.settings || {})) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const sub = Object.entries(val).map(([k, v]) => { const f = fmtVal(guild, v); return f ? `• ${k}: ${f}` : null; }).filter(Boolean);
      if (sub.length) lines.push(`__${group}__\n${sub.join('\n')}`);
    } else {
      const f = fmtVal(guild, val);
      if (f) lines.push(`• ${group}: ${f}`);
    }
  }
  const settings = lines.join('\n').slice(0, 3500) || '_Nothing configured yet — run `!setup`._';
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`🔧 Configuration — ${guild.name}`)
    .setDescription(`🌐 **Language:** ${cfg.language || 'en'}\n\n🧩 **Modules**\n${modules}`)
    .addFields({ name: '⚙️ Settings', value: settings })
    .setFooter({ text: 'Edit everything with !setup' });
}

function channelsEmbed(guild) {
  const all = [...guild.channels.cache.values()];
  const cats = all.filter((c) => c.type === ChannelType.GuildCategory).sort((a, b) => a.position - b.position);
  const childrenOf = (id) => all.filter((c) => c.parentId === id && c.type !== ChannelType.GuildCategory).sort((a, b) => a.rawPosition - b.rawPosition);
  const line = (c) => `${TYPE_ICON[c.type] || '•'} ${c.name}`;
  const blocks = [];
  const orphans = all.filter((c) => !c.parentId && c.type !== ChannelType.GuildCategory).sort((a, b) => a.rawPosition - b.rawPosition);
  if (orphans.length) blocks.push(orphans.map(line).join('\n'));
  for (const cat of cats) {
    const kids = childrenOf(cat.id);
    blocks.push(`📁 **${cat.name}**\n${kids.map((c) => '　' + line(c)).join('\n') || '　_empty_'}`);
  }
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`📚 Channels — ${guild.name}`)
    .setDescription(blocks.join('\n\n').slice(0, 4000) || 'No channels.')
    .setFooter({ text: `${all.length} channels · ${cats.length} categories` });
}

export async function handleServerText(message) {
  const raw = (message.content || '').trim();
  if (!/^!server\b/i.test(raw)) return false;
  if (!message.guild) { await message.reply('❌ Use `!server` inside a server.').catch(() => {}); return true; }
  const parts = raw.split(/\s+/);
  const sub = (parts[1] || '').toLowerCase();
  const member = message.member;

  if (!sub || sub === 'help') { await message.reply(HELP).catch(() => {}); return true; }

  if (sub === 'config' || sub === 'info' || sub === 'settings') {
    if (!can(member, PermissionFlagsBits.ManageGuild)) { await message.reply('❌ You need **Manage Server**.').catch(() => {}); return true; }
    await message.reply({ embeds: [configEmbed(message.guild)] }).catch(() => {});
    return true;
  }

  if (sub === 'channels' || sub === 'chans') {
    if (!can(member, PermissionFlagsBits.ManageGuild)) { await message.reply('❌ You need **Manage Server**.').catch(() => {}); return true; }
    await message.reply({ embeds: [channelsEmbed(message.guild)] }).catch(() => {});
    return true;
  }

  if (sub === 'newchannel' || sub === 'createchannel' || sub === 'newcategory' || sub === 'createcategory') {
    if (!can(member, PermissionFlagsBits.ManageChannels)) { await message.reply('❌ You need **Manage Channels**.').catch(() => {}); return true; }
    if (!message.guild.members.me?.permissions.has(PermissionFlagsBits.ManageChannels)) { await message.reply('❌ I don’t have **Manage Channels** permission.').catch(() => {}); return true; }
    const isCat = sub.includes('category');
    const args = parts.slice(2);
    if (!args.length) { await message.reply(`❌ Usage: \`!server ${sub} <name> ${isCat ? '' : '[type] [category]'}\``).catch(() => {}); return true; }

    let type = ChannelType.GuildCategory;
    let name = args[0];
    let parent = null;
    if (!isCat) {
      name = args[0];
      const typeTok = (args[1] || 'text').toLowerCase();
      type = NEW_TYPES[typeTok] ?? ChannelType.GuildText;
      const catName = args.slice(NEW_TYPES[typeTok] !== undefined ? 2 : 1).join(' ');
      if (catName) {
        const cat = message.guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === catName.toLowerCase());
        if (cat) parent = cat.id; else { await message.reply(`⚠️ No category named **${catName}** — creating without one.`).catch(() => {}); }
      }
    }
    try {
      const created = await message.guild.channels.create({ name: name.slice(0, 90), type, parent: parent || undefined });
      await message.reply(`✅ Created ${isCat ? `category **${created.name}**` : `<#${created.id}>`}${parent ? ` under its category` : ''}.`).catch(() => {});
    } catch (err) {
      await message.reply(`⚠️ Couldn’t create it: ${err.message}`).catch(() => {});
    }
    return true;
  }

  await message.reply('❓ Unknown `!server` command. Try `!server help`.').catch(() => {});
  return true;
}
