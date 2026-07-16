// Handles direct messages to the bot and routes them to the Gemini AI coach.
// The AI only ever sees the hand of the user it is replying to (handled in gemini.js).
import { ChannelType } from 'discord.js';
import { chatWithAI } from './ai/gemini.js';

export async function handleDM(message) {
  if (message.author.bot) return;
  if (message.channel.type !== ChannelType.DM) return;

  const text = message.content?.trim();
  if (!text) return;

  await message.channel.sendTyping().catch(() => {});
  const reply = await chatWithAI(message.author.id, text);

  // Discord caps messages at 2000 chars.
  await message.reply(reply.slice(0, 2000)).catch(() => {});
}
