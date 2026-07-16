import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('avatar')
  .setDescription("Show a user's avatar")
  .addUserOption((o) => o.setName('user').setDescription('User (defaults to you)'));

export async function execute(interaction) {
  const user = interaction.options.getUser('user') ?? interaction.user;
  const url = user.displayAvatarURL({ size: 1024 });
  const embed = new EmbedBuilder()
    .setTitle(`🖼️ ${user.tag}'s avatar`)
    .setColor(0xeb459e)
    .setImage(url)
    .setDescription(`[Open full size](${url})`);
  await interaction.reply({ embeds: [embed] });
}
