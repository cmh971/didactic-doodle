import { SlashCommandBuilder } from 'discord.js';
import { rint, pick } from '../../util.js';

export const data = new SlashCommandBuilder().setName('lotto').setDescription("Generate lucky lotto numbers");

export async function execute(interaction) {
  const out = (function () { const s=new Set();while(s.size<6)s.add(rint(1,49));return '🎟️ ' + [...s].sort((a,b)=>a-b).join(' - '); })();
  await interaction.reply(String(out).slice(0, 1990));
}
