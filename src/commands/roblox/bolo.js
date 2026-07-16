import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { bolo } from '../../features/management.js';

export const data = new SlashCommandBuilder()
  .setName('bolo')
  .setDescription('Manage BOLOs / ban requests')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addSubcommand((s) => s.setName('create').setDescription('Create a BOLO / ban request')
    .addStringOption((o) => o.setName('roblox_user').setDescription('Roblox username').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true)))
  .addSubcommand((s) => s.setName('pending').setDescription('View active/pending BOLOs'));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const g = interaction.guildId;
  if (sub === 'create') {
    const user = interaction.options.getString('roblox_user');
    const reason = interaction.options.getString('reason');
    const info = bolo.create.run(g, user, reason, interaction.user.id);
    return interaction.reply(`🚨 **BOLO #${info.lastInsertRowid}** created for **${user}** — ${reason}`);
  }
  const rows = bolo.pending.all(g);
  if (!rows.length) return interaction.reply({ content: '✅ No pending BOLOs.', flags: MessageFlags.Ephemeral });
  const embed = new EmbedBuilder().setColor(0xe74c3c).setTitle('🚨 Pending BOLOs')
    .setDescription(rows.map((r) => `**#${r.id}** **${r.roblox_user}** — ${r.reason} · by <@${r.created_by}> · <t:${r.created_at}:R>`).join('\n').slice(0, 4000));
  return interaction.reply({ embeds: [embed] });
}
