import { SlashCommandBuilder } from 'discord.js';
import { renderHelp } from '../../help/ui.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Browse every command by category (use the ◀️ ▶️ arrows)');

export async function execute(interaction) {
  await interaction.reply(renderHelp(interaction.client, 0));
}
