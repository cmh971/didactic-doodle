import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { erlc, runCommand } from '../../features/erlc.js';
import { setSetting } from '../../setup/store.js';
import { encryptSecret } from '../../systems/secureStore.js';

const eph = (c) => ({ content: c, flags: MessageFlags.Ephemeral });
const lines = (arr, fn, max = 12) => (Array.isArray(arr) && arr.length ? arr.slice(0, max).map(fn).join('\n') : '_none_');

export const data = new SlashCommandBuilder()
  .setName('erlc')
  .setDescription('ER:LC (Liberty County) integration via the PRC API')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((s) => s.setName('server').setDescription('Server info'))
  .addSubcommand((s) => s.setName('players').setDescription('Online players'))
  .addSubcommand((s) => s.setName('staff').setDescription('Online staff'))
  .addSubcommand((s) => s.setName('queue').setDescription('Join queue'))
  .addSubcommand((s) => s.setName('bans').setDescription('In-game bans'))
  .addSubcommand((s) => s.setName('joins').setDescription('Join/leave logs'))
  .addSubcommand((s) => s.setName('kills').setDescription('Kill logs'))
  .addSubcommand((s) => s.setName('logs').setDescription('Command logs'))
  .addSubcommand((s) => s.setName('modcalls').setDescription('Mod calls'))
  .addSubcommand((s) => s.setName('vehicles').setDescription('Spawned vehicles'))
  .addSubcommand((s) => s.setName('execute').setDescription('Run an in-game command').addStringOption((o) => o.setName('command').setDescription('e.g. :h Hello').setRequired(true)))
  .addSubcommand((s) => s.setName('tempban').setDescription('Ban a player in-game').addStringOption((o) => o.setName('user').setDescription('Roblox username/id').setRequired(true)))
  .addSubcommand((s) => s.setName('untempban').setDescription('Unban a player in-game').addStringOption((o) => o.setName('user').setDescription('Roblox username/id').setRequired(true)))
  .addSubcommand((s) => s.setName('link').setDescription('Link your ER:LC private server (paste key securely)'))
  .addSubcommand((s) => s.setName('setup').setDescription('How to link your server + set up Command Logs'));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const g = interaction.guildId;

  // Link: show a modal so the key is NEVER posted in a channel. (No defer — modals
  // must be the initial interaction response.)
  if (sub === 'link') {
    const modal = new ModalBuilder().setCustomId('erlc:linkmodal').setTitle('Link ER:LC Private Server');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('key').setLabel('Private Server API Key').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Paste your ER:LC server key'),
    ));
    return interaction.showModal(modal);
  }

  await interaction.deferReply();

  if (sub === 'setup') {
    const embed = new EmbedBuilder().setColor(0x2ecc71).setTitle('🚓 ER:LC Setup')
      .setDescription('Connect your Liberty County private server to the bot.')
      .addFields(
        { name: '1️⃣ Link your ER:LC Private Server', value: 'So the bot can read your server and reply to in-game commands via in-game PMs, run **`/erlc link`** and paste your **private-server key**. It’s stored **encrypted** (AES-256-GCM), never shown in chat. Test with `/erlc server`.' },
        { name: '2️⃣ ER:LC Command Logs (optional)', value: 'To mirror every in-game command into a Discord channel:\n• Create a channel → **Edit ▸ Integrations ▸ New Webhook** → **Copy URL** (name/avatar don’t matter).\n• In your **ER:LC private server settings**, search **Command Logs Webhook** → **Edit** → paste the URL.\n\nThe bot can also pull them anytime with **`/erlc logs`**.' },
      )
      .setFooter({ text: 'Manage Server permission required' });
    return interaction.editReply({ embeds: [embed] });
  }

  // Action subcommands
  if (sub === 'execute' || sub === 'tempban' || sub === 'untempban') {
    const cmd = sub === 'execute' ? interaction.options.getString('command')
      : sub === 'tempban' ? `:ban ${interaction.options.getString('user')}`
        : `:unban ${interaction.options.getString('user')}`;
    const r = await runCommand(g, cmd);
    return interaction.editReply(r.ok ? `✅ Sent to server: \`${cmd}\`` : `❌ ${r.error}`);
  }

  const ENDPOINTS = {
    server: '/server', players: '/server/players', staff: '/server/players',
    queue: '/server/queue', bans: '/server/bans', joins: '/server/joinlogs',
    kills: '/server/killlogs', logs: '/server/commandlogs', modcalls: '/server/modcalls',
    vehicles: '/server/vehicles',
  };
  const r = await erlc(g, ENDPOINTS[sub]);
  if (!r.ok) return interaction.editReply(`❌ ${r.error}`);
  const d = r.data;
  const embed = new EmbedBuilder().setColor(0x2ecc71).setTitle(`🚓 ERLC — ${sub}`);

  switch (sub) {
    case 'server':
      embed.setDescription(`**${d.Name}**\nPlayers: **${d.CurrentPlayers}/${d.MaxPlayers}**\nJoin key: \`${d.JoinKey}\`\nOwner: ${d.OwnerId}\nTeam balance: ${d.TeamBalance ? 'on' : 'off'}`);
      break;
    case 'players':
      embed.setDescription(`**${d.length}** online:\n` + lines(d, (p) => `• ${p.Player} — ${p.Team || '?'} (${p.Permission || 'Normal'})`));
      break;
    case 'staff':
      embed.setDescription(lines(d.filter((p) => p.Permission && p.Permission !== 'Normal'), (p) => `• ${p.Player} — ${p.Permission}`) || '_no staff online_');
      break;
    case 'queue':
      embed.setDescription(`**${d.length}** in queue: ${d.length ? d.slice(0, 20).join(', ') : '_empty_'}`);
      break;
    case 'bans':
      { const ent = Object.entries(d || {}); embed.setDescription(`**${ent.length}** bans\n` + lines(ent, ([id, name]) => `• ${name} (\`${id}\`)`)); }
      break;
    case 'joins':
      embed.setDescription(lines(d, (j) => `${j.Join ? '🟢 join' : '🔴 leave'} **${j.Player}** <t:${j.Timestamp}:R>`));
      break;
    case 'kills':
      embed.setDescription(lines(d, (k) => `💀 ${k.Killer} → ${k.Killed} <t:${k.Timestamp}:R>`));
      break;
    case 'logs':
      embed.setDescription(lines(d, (c) => `\`${c.Command}\` — ${c.Player} <t:${c.Timestamp}:R>`));
      break;
    case 'modcalls':
      embed.setDescription(lines(d, (m) => `📟 ${m.Caller}${m.Moderator ? ` → ${m.Moderator}` : ''} <t:${m.Timestamp}:R>`));
      break;
    case 'vehicles':
      embed.setDescription(`**${d.length}** vehicles\n` + lines(d, (v) => `🚗 ${v.Name} — ${v.Owner}`));
      break;
    default:
      embed.setDescription('```json\n' + JSON.stringify(d, null, 2).slice(0, 1800) + '\n```');
  }
  return interaction.editReply({ embeds: [embed] });
}

// Open the secure key modal from a button (customId erlc:setkey) — lets the
// `!erlc key` prefix command set the key without needing the slash command.
export async function showErlcKeyModal(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) { await interaction.reply(eph('🔒 Needs **Manage Server**.')).catch(() => {}); return; }
  const modal = new ModalBuilder().setCustomId('erlc:linkmodal').setTitle('Link ER:LC Private Server');
  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId('key').setLabel('Private Server API Key').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Paste your ER:LC server key'),
  ));
  await interaction.showModal(modal).catch(() => {});
}

// Secure key intake from the /erlc link modal (routed from index.js: customId erlc:linkmodal).
export async function handleErlcModal(interaction) {
  if (interaction.customId !== 'erlc:linkmodal') return false;
  const key = (interaction.fields.getTextInputValue('key') || '').trim();
  if (!key) { await interaction.reply(eph('❌ No key provided.')).catch(() => {}); return true; }
  setSetting(interaction.guildId, 'erlcKeyEnc', encryptSecret(key));
  await interaction.reply(eph('✅ ER:LC private server linked — key stored **encrypted**. Test it with `/erlc server`.')).catch(() => {});
  return true;
}
