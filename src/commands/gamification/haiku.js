import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';
const LINES = [
  "Cards on the table / a wild four changes it all / silence, then a groan",
  "Tokens in my purse / I gamble them all away / the slots show three sevens",
  "Winter UNO night / the reverse card spins us back / friendships gently tested"
];
export const data = new SlashCommandBuilder().setName('haiku').setDescription('Random haiku');
export async function execute(interaction) { await interaction.reply('🍃 ' + pick(LINES)); }
