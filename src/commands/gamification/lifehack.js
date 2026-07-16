import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "Use a binder clip to organize cables.",
  "Microwave a lemon before juicing for more juice.",
  "Put your phone on airplane mode to charge faster.",
  "Use a dab of toothpaste to clean foggy headlights.",
  "Freeze grapes to chill wine without watering it down."
];

export const data = new SlashCommandBuilder()
  .setName('lifehack')
  .setDescription('Random lifehack');

export async function execute(interaction) {
  await interaction.reply('💡 ' + pick(LINES));
}
