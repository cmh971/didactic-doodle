import { SlashCommandBuilder } from 'discord.js';
import { rint, pick } from '../../util.js';

export const data = new SlashCommandBuilder().setName('randomanimal').setDescription("Get a random animal");

export async function execute(interaction) {
  const out = (function () { return '🐾 ' + pick(['Red Panda','Axolotl','Capybara','Narwhal','Pangolin','Quokka','Otter','Fennec Fox','Sloth','Platypus']); })();
  await interaction.reply(String(out).slice(0, 1990));
}
