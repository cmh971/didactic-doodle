import { SlashCommandBuilder } from 'discord.js';
import { rint, pick } from '../../util.js';
export const data = new SlashCommandBuilder().setName('dndstats').setDescription("Roll a D&D stat block (4d6 drop lowest ×6)");
export async function execute(interaction) { const out = (function () { const roll=()=>{const r=[rint(1,6),rint(1,6),rint(1,6),rint(1,6)].sort((a,b)=>a-b);return r[1]+r[2]+r[3];};return '🐉 STR ' + roll() + ' · DEX ' + roll() + ' · CON ' + roll() + ' · INT ' + roll() + ' · WIS ' + roll() + ' · CHA ' + roll(); })(); await interaction.reply(String(out).slice(0, 1990)); }
