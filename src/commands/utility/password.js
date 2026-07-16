import { SlashCommandBuilder } from 'discord.js';
import { randomBytes } from 'node:crypto';
import { eph } from '../../util.js';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';

export const data = new SlashCommandBuilder()
  .setName('password')
  .setDescription('Generate a secure random password (sent privately)')
  .addIntegerOption((o) => o.setName('length').setDescription('Length (8-64)').setMinValue(8).setMaxValue(64));

export async function execute(interaction) {
  const len = interaction.options.getInteger('length') ?? 16;
  const bytes = randomBytes(len);
  let pw = '';
  for (let i = 0; i < len; i++) pw += CHARS[bytes[i] % CHARS.length];
  await interaction.reply(eph(`🔐 Your password:\n\`\`\`\n${pw}\n\`\`\``));
}
