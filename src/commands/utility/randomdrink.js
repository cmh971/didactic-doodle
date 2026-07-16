import { SlashCommandBuilder } from 'discord.js';
import { rint, pick } from '../../util.js';
export const data = new SlashCommandBuilder().setName('randomdrink').setDescription("Pick a random drink");
export async function execute(interaction) { const out = (function () { return '🥤 ' + pick(['iced coffee','bubble tea','lemonade','hot cocoa','smoothie','green tea','milkshake','sparkling water']); })(); await interaction.reply(String(out).slice(0, 1990)); }
