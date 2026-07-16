import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('reverse')
  .setDescription('Reverse your text')
  .addStringOption((o) => o.setName('text').setDescription('Text to reverse').setRequired(true));

export async function execute(interaction) {
  await interaction.reply([...interaction.options.getString('text')].reverse().join('').slice(0, 2000));
}
