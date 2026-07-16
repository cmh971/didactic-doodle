import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('poll')
  .setDescription('Create a simple yes/no reaction poll')
  .addStringOption((o) => o.setName('question').setDescription('The poll question').setRequired(true));

export async function execute(interaction) {
  const question = interaction.options.getString('question');
  const embed = new EmbedBuilder()
    .setTitle('📊 Poll')
    .setColor(0xfee75c)
    .setDescription(question)
    .setFooter({ text: `Asked by ${interaction.user.tag}` });

  await interaction.reply({ embeds: [embed], withResponse: false });
  const msg = await interaction.fetchReply();
  await msg.react('👍');
  await msg.react('👎');
}
