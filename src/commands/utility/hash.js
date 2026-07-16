import { SlashCommandBuilder } from 'discord.js';
import { createHash } from 'node:crypto';

export const data = new SlashCommandBuilder()
  .setName('hash')
  .setDescription('Hash text with a chosen algorithm')
  .addStringOption((o) =>
    o.setName('algorithm').setDescription('Algorithm').setRequired(true).addChoices(
      { name: 'md5', value: 'md5' },
      { name: 'sha1', value: 'sha1' },
      { name: 'sha256', value: 'sha256' },
      { name: 'sha512', value: 'sha512' },
    ),
  )
  .addStringOption((o) => o.setName('text').setDescription('Text to hash').setRequired(true));

export async function execute(interaction) {
  const algo = interaction.options.getString('algorithm');
  const text = interaction.options.getString('text');
  const digest = createHash(algo).update(text).digest('hex');
  await interaction.reply(`🔑 **${algo}**\n\`\`\`\n${digest}\n\`\`\``);
}
