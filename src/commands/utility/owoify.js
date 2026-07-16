import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const FACES = ['(◕ω◕)', 'owo', 'uwu', '>w<', '^w^', '(*≧ω≦)'];

export const data = new SlashCommandBuilder()
  .setName('owoify')
  .setDescription('OwO-ify your text')
  .addStringOption((o) => o.setName('text').setDescription('Text to owoify').setRequired(true));

export async function execute(interaction) {
  const out = interaction.options
    .getString('text')
    .replace(/[rl]/g, 'w')
    .replace(/[RL]/g, 'W')
    .replace(/n([aeiou])/gi, 'ny$1')
    .replace(/\b(\w)/g, (m) => (Math.random() < 0.15 ? `${m}-${m}` : m))
    + ` ${pick(FACES)}`;
  await interaction.reply(out.slice(0, 2000));
}
