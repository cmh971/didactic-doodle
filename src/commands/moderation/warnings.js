import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { recentInfractions, infractionCount } from '../../systems/automod.js';

export const data = new SlashCommandBuilder()
  .setName('warnings')
  .setDescription('View a member\'s infraction history')
  .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction) {
  if (!interaction.guild) return interaction.reply({ content: '❌ Use this in a server.', flags: MessageFlags.Ephemeral });
  const user = interaction.options.getUser('user');
  const total = infractionCount(interaction.guild.id, user.id);
  const rows = recentInfractions(interaction.guild.id, user.id, 10);
  const list = rows.length
    ? rows
        .map((r) => `**#${r.id}** \`${r.type}\` — ${r.reason || 'no reason'} · <t:${r.created_at}:R>`)
        .join('\n')
    : '_No infractions on record._';
  const embed = new EmbedBuilder()
    .setColor(total ? 0xe67e22 : 0x2ecc71)
    .setTitle(`🗂️ Infractions — ${user.username}`)
    .setDescription(`**Total:** ${total}\n\n${list}`);
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
