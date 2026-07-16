import { SlashCommandBuilder } from 'discord.js';
import { chatWithAI } from '../../ai/gemini.js';

export const data = new SlashCommandBuilder()
  .setName('ask')
  .setDescription('Ask the AI anything')
  .addStringOption((o) => o.setName('question').setDescription('Your question').setRequired(true));

export async function execute(interaction) {
  const question = interaction.options.getString('question');
  await interaction.deferReply();
  const reply = await chatWithAI(interaction.user.id, question);
  await interaction.editReply(reply.slice(0, 2000));
}
