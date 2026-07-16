import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('roleinfo')
  .setDescription('Show details about a role')
  .addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true));

export async function execute(interaction) {
  const role = interaction.options.getRole('role');
  const embed = new EmbedBuilder()
    .setColor(role.color || 0x99aab5)
    .setTitle(`🏷️ ${role.name}`)
    .addFields(
      { name: 'ID', value: role.id, inline: true },
      { name: 'Members', value: String(role.members?.size ?? 'n/a'), inline: true },
      { name: 'Color', value: role.hexColor, inline: true },
      { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
      { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
      { name: 'Position', value: String(role.position), inline: true },
      { name: 'Created', value: `<t:${Math.floor(role.createdTimestamp / 1000)}:R>`, inline: true },
    );
  await interaction.reply({ embeds: [embed] });
}
