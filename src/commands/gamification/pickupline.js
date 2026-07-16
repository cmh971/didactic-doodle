import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "Are you a wild +4? Because you just changed my whole game.",
  "Do you have a map? I keep getting lost in your eyes.",
  "Are you Wi-Fi? Because I'm feeling a connection.",
  "You must be a UNO card, because you're a perfect match."
];

export const data = new SlashCommandBuilder()
  .setName('pickupline')
  .setDescription('Random pickupline');

export async function execute(interaction) {
  await interaction.reply('😏 ' + pick(LINES));
}
