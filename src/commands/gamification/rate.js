import { SlashCommandBuilder } from 'discord.js';

function seeded(str) {
  let h = 0;
  for (const c of str.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 101;
}

export const data = new SlashCommandBuilder()
  .setName('rate')
  .setDescription('Let the bot rate anything out of 100')
  .addStringOption((o) => o.setName('thing').setDescription('What to rate').setRequired(true));

export async function execute(interaction) {
  const thing = interaction.options.getString('thing');
  const pct = seeded(thing);
  await interaction.reply(`📊 I rate **${thing}** a solid **${pct}/100**.`);
}
