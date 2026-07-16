import { SlashCommandBuilder } from 'discord.js';
import { randomUUID } from 'node:crypto';

export const data = new SlashCommandBuilder().setName('uuid').setDescription('Generate a random UUID v4');

export async function execute(interaction) {
  await interaction.reply('🆔 \`' + randomUUID() + '\`');
}
