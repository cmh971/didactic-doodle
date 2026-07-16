import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { erlc, runCommand } from '../../features/erlc.js';

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
  .addSubcommand((s) => s.setName('untempban').setDescription('Unban a player in-game').addStringOption((o) => o.setName('user').setDescription('Roblox username/id').setRequired(true)));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const g = interaction.guildId;
  await interaction.deferReply();

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
