import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { applyAction, listRanks } from '../../features/staff.js';

const eph = (content) => ({ content, flags: MessageFlags.Ephemeral });

export const data = new SlashCommandBuilder()
  .setName('staff')
  .setDescription('Promote, demote, infract, or adjust a member\'s roles')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .setDMPermission(false)
  .addSubcommand((s) => s.setName('promote').setDescription('Move a member up one rank on the ladder')
    .addUserOption((o) => o.setName('member').setDescription('Who to promote').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason')))
  .addSubcommand((s) => s.setName('demote').setDescription('Move a member down one rank on the ladder')
    .addUserOption((o) => o.setName('member').setDescription('Who to demote').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason')))
  .addSubcommand((s) => s.setName('infract').setDescription('Log an infraction (optionally apply a role)')
    .addUserOption((o) => o.setName('member').setDescription('Who to infract').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true))
    .addRoleOption((o) => o.setName('role').setDescription('Role to add (e.g. Suspended)')))
  .addSubcommand((s) => s.setName('addrole').setDescription('Give a member a role')
    .addUserOption((o) => o.setName('member').setDescription('Member').setRequired(true))
    .addRoleOption((o) => o.setName('role').setDescription('Role to add').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason')))
  .addSubcommand((s) => s.setName('removerole').setDescription('Remove a role from a member')
    .addUserOption((o) => o.setName('member').setDescription('Member').setRequired(true))
    .addRoleOption((o) => o.setName('role').setDescription('Role to remove').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason')))
  .addSubcommand((s) => s.setName('ranks').setDescription('Show the configured rank ladder'));

const ICON = { promote: '⬆️', demote: '⬇️', infract: '⚠️', addrole: '➕', removerole: '➖' };

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  if (sub === 'ranks') {
    const ranks = listRanks(guildId);
    if (!ranks.length) return interaction.reply(eph('No rank ladder set up yet. Configure it on the dashboard ▸ **Staff Manager**.'));
    const list = ranks.map((r, i) => `**${i + 1}.** ${r.name} — <@&${r.roleId}>`).join('\n');
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('🪜 Rank Ladder').setDescription(list)], flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const member = interaction.options.getUser('member');
  const role = interaction.options.getRole('role');
  const reason = interaction.options.getString('reason') || '';

  const r = await applyAction(interaction.client, {
    guildId, targetId: member.id, action: sub, roleId: role?.id,
    moderatorId: interaction.user.id, reason,
  });
  if (!r.ok) return interaction.editReply(`❌ ${r.error}`);

  const embed = new EmbedBuilder()
    .setColor(sub === 'demote' || sub === 'infract' || sub === 'removerole' ? 0xed4245 : 0x57f287)
    .setDescription(`${ICON[sub]} **${sub}** applied to <@${member.id}> — ${r.detail}${reason ? `\n📝 ${reason}` : ''}`)
    .setFooter({ text: `By ${interaction.user.username}` });
  return interaction.editReply({ embeds: [embed] });
}
