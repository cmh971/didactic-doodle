// Suggestions box — any message posted in the suggestions channel is turned into a
// clean embed with 👍 / 👎 vote reactions, and the original is removed. Configured on
// the /setup wizard's Suggestions page (settings.suggestions).
import { EmbedBuilder } from 'discord.js';
import { getCfg } from '../setup/store.js';

export async function handleSuggestionMessage(message) {
  const cfg = getCfg(message.guild.id).settings.suggestions || {};
  if (!cfg.enabled || cfg.channel !== message.channel.id) return false;

  const text = (message.content || '').trim();
  if (!text) return false;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL?.() })
    .setDescription(text.slice(0, 2000))
    .setFooter({ text: '👍 upvote  ·  👎 downvote' })
    .setTimestamp();

  const sent = await message.channel.send({ embeds: [embed] }).catch(() => null);
  if (sent) {
    await sent.react('👍').catch(() => {});
    await sent.react('👎').catch(() => {});
  }
  await message.delete().catch(() => {}); // needs Manage Messages; harmless if it fails
  return true;
}
