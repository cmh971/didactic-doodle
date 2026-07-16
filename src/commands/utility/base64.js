import { SlashCommandBuilder } from 'discord.js';
import { eph } from '../../util.js';

export const data = new SlashCommandBuilder()
  .setName('base64')
  .setDescription('Encode or decode base64')
  .addStringOption((o) =>
    o.setName('mode').setDescription('encode or decode').setRequired(true).addChoices(
      { name: 'encode', value: 'encode' },
      { name: 'decode', value: 'decode' },
    ),
  )
  .addStringOption((o) => o.setName('text').setDescription('Text to convert').setRequired(true));

export async function execute(interaction) {
  const mode = interaction.options.getString('mode');
  const text = interaction.options.getString('text');
  try {
    const out =
      mode === 'encode'
        ? Buffer.from(text, 'utf8').toString('base64')
        : Buffer.from(text, 'base64').toString('utf8');
    await interaction.reply(`\`\`\`\n${out.slice(0, 1900)}\n\`\`\``);
  } catch {
    await interaction.reply(eph('❌ Could not convert that.'));
  }
}
