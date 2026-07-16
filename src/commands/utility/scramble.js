import { SlashCommandBuilder } from 'discord.js';
import { rint, pick } from '../../util.js';

export const data = new SlashCommandBuilder().setName('scramble').setDescription("Get a scrambled word to unscramble");

export async function execute(interaction) {
  const out = (function () { const w=pick(['planet','dragon','wizard','rocket','garden','castle']);const a=[...w];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return '🔀 Unscramble: **'+a.join('')+'** ||('+w+')||'; })();
  await interaction.reply(String(out).slice(0, 1990));
}
