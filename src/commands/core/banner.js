import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('banner')
  .setDescription('Show a user\'s profile banner')
  .addUserOption((o) => o.setName('user').setDescription('User (defaults to you)'));

export async function execute(interaction) {
  const target = interaction.options.getUser('user') ?? interaction.user;
  const user = await target.fetch(); // force-fetch to populate banner
  const url = user.bannerURL({ size: 1024 });
  if (!url) return interaction.reply({ content: `**${user.username}** has no banner set.`, flags: MessageFlags.Ephemeral });
  const embed = new EmbedBuilder().setColor(user.accentColor || 0x5865f2).setTitle(`${user.username}'s banner`).setImage(url);
  await interaction.reply({ embeds: [embed] });
}
