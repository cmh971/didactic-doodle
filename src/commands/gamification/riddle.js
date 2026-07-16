import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "What has keys but no locks? || A piano. ||",
  "What gets wetter the more it dries? || A towel. ||",
  "What has hands but can't clap? || A clock. ||",
  "What can travel the world while staying in a corner? || A stamp. ||"
];

export const data = new SlashCommandBuilder()
  .setName('riddle')
  .setDescription('Random riddle');

export async function execute(interaction) {
  await interaction.reply('🧩 ' + pick(LINES));
}
