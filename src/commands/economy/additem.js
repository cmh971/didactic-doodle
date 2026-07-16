import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { proposeShopItem } from '../../ai/gemini.js';
import { addShopItem } from '../../economy/store.js';
import { eph } from '../../util.js';
import { TOKEN } from '../../config.js';
import { fmt } from '../../render/extras.js';

export const data = new SlashCommandBuilder()
  .setName('additem')
  .setDescription('Ask the AI to approve & add a new collectible to the shop')
  .addStringOption((o) =>
    o.setName('idea').setDescription('Describe the item you want (the AI designs it)').setRequired(true),
  );

export async function execute(interaction) {
  const idea = interaction.options.getString('idea');
  await interaction.deferReply();

  const item = await proposeShopItem(interaction.user.id, idea);
  const r = addShopItem(item);
  if (!r.ok) return interaction.editReply(eph(`❌ ${r.reason}`));

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('🤖 AI Shopkeeper — Item Approved!')
    .setDescription(
      `**${item.name}**\n${item.description}\n\n` +
        `**Price:** ${TOKEN} ${fmt(item.price)}\n**Item id:** \`${item.id}\`\n\n` +
        `It's now in the \`/shop\` — buy it with \`/buy ${item.id}\`!`,
    )
    .setFooter({ text: `Suggested by ${interaction.user.username}` });
  await interaction.editReply({ embeds: [embed] });
}
