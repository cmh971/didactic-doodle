import { SlashCommandBuilder } from 'discord.js';
import { rint, pick } from '../../util.js';
export const data = new SlashCommandBuilder().setName('randomfood').setDescription("Pick a random food");
export async function execute(interaction) { const out = (function () { return '🍽️ ' + pick(['tacos','ramen','pizza','sushi','curry','burgers','dumplings','pasta','pho','falafel']); })(); await interaction.reply(String(out).slice(0, 1990)); }
