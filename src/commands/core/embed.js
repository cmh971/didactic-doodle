import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('embed')
  .setDescription('Build a simple custom embed')
  .addStringOption((o) => o.setName('title').setDescription('Embed title').setRequired(true))
  .addStringOption((o) => o.setName('description').setDescription('Embed body').setRequired(true))
  .addStringOption((o) => o.setName('color').setDescription('Hex color like #ff8800'));

export async function execute(interaction) {
  const title = interaction.options.getString('title');
  const description = interaction.options.getString('description');
  let color = 0x5865f2;
  const raw = interaction.options.getString('color');
  if (raw) {
    const hex = raw.replace('#', '');
    if (/^[0-9a-fA-F]{6}$/.test(hex)) color = parseInt(hex, 16);
    else return interaction.reply({ content: '❌ Color must be a hex like `#ff8800`.', flags: MessageFlags.Ephemeral });
  }
  const embed = new EmbedBuilder().setColor(color).setTitle(title.slice(0, 256)).setDescription(description.slice(0, 4000));
  await interaction.reply({ embeds: [embed] });
}
