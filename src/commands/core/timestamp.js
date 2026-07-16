import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('timestamp')
  .setDescription('Generate a Discord timestamp code')
  .addIntegerOption((o) => o.setName('in_minutes').setDescription('Minutes from now (default 0)'))
  .addStringOption((o) =>
    o.setName('style').setDescription('Display style').addChoices(
      { name: 'Short Time', value: 't' },
      { name: 'Long Date/Time', value: 'F' },
      { name: 'Relative', value: 'R' },
      { name: 'Date', value: 'D' },
    ),
  );

export async function execute(interaction) {
  const mins = interaction.options.getInteger('in_minutes') ?? 0;
  const style = interaction.options.getString('style') ?? 'F';
  const epoch = Math.floor((Date.now() + mins * 60000) / 1000);
  const code = `<t:${epoch}:${style}>`;
  await interaction.reply(`Preview: ${code}\nCopy this: \`${code}\``);
}
