import { SlashCommandBuilder } from 'discord.js';
import { askAsh, imagePartsFromAttachments, registerAshMessage } from '../../ai/ash.js';

export const data = new SlashCommandBuilder()
  .setName('ask')
  .setDescription('Ask the AI anything — it can search the web and see an image you attach')
  .addStringOption((o) => o.setName('question').setDescription('Your question').setRequired(true))
  .addAttachmentOption((o) => o.setName('image').setDescription('Optional image for the AI to look at'));

export async function execute(interaction) {
  const question = interaction.options.getString('question');
  const image = interaction.options.getAttachment('image');
  await interaction.deferReply();

  const images = image ? await imagePartsFromAttachments([image]).catch(() => []) : [];
  // Resolve any @mentions in the question so Ash can recall those members' profiles.
  const mentions = [...new Set(question.match(/<@!?\d+>/g) || [])]
    .map((tok) => {
      const id = tok.replace(/\D/g, '');
      const name = interaction.guild?.members?.cache.get(id)?.displayName
        || interaction.client.users.cache.get(id)?.username || null;
      return { id, name };
    })
    .filter((m) => m.name)
    .slice(0, 5);
  const { text, embed, components } = await askAsh({
    channelId: interaction.channelId,
    authorTag: interaction.user.username,
    authorId: interaction.user.id,
    guildId: interaction.guildId || 'dm',
    text: question,
    images,
    mentions,
  });

  const payload = {};
  if (text) payload.content = text.slice(0, 2000);
  if (embed) payload.embeds = [embed];
  if (components) payload.components = components;
  if (!payload.content && !payload.embeds) payload.content = '🤖';

  const sent = await interaction.editReply(payload);
  try { if (sent?.id) registerAshMessage(sent.id, interaction.channelId); } catch { /* reactions optional */ }
}
