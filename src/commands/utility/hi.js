import { SlashCommandBuilder } from 'discord.js';

// This is the "recipe card" the bot reads to know the command exists.
export const data = new SlashCommandBuilder()
  .setName('hi')
  .setDescription('The bot says hi back!');

// This runs every time someone uses /hi. `interaction` is the person's click.
export async function execute(interaction) {
  await interaction.reply(`HI ${interaction.user}!`);
}
