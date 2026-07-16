import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';
const FACTS = ['it rewards patience','is better shared with friends','changes when you least expect it','is 10% luck and 90% effort','always has another level'];
const TIPS = ['start small and stay consistent','take a short break, then retry','ask someone you trust','write it down first','sleep on the big choices'];
const QUOTES = ['"Keep going." — Everyone wise','"Fortune favors the bold."','"Small steps, big journeys."','"You miss 100% of shots you don\'t take."','"Done beats perfect."'];
export const data = new SlashCommandBuilder().setName('movietip').setDescription('A random movie tip');
export async function execute(interaction) {
  await interaction.reply('💡 **movie** tip: movie ' + pick(TIPS));
}
