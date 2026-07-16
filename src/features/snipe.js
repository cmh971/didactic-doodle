// Keeps the last few deleted messages per channel (in memory) for /snipe.
const MAX_PER_CHANNEL = 5;
const store = new Map(); // channelId -> [{content, author, avatar, at, attachment}]

export function handleMessageDelete(message) {
  if (!message.guild || message.author?.bot) return;
  if (!message.content && !message.attachments?.size) return;
  const list = store.get(message.channelId) || [];
  list.unshift({
    content: message.content || '',
    author: message.author?.tag || 'Unknown',
    avatar: message.author?.displayAvatarURL?.() || null,
    at: Date.now(),
    attachment: message.attachments?.first()?.url || null,
  });
  store.set(message.channelId, list.slice(0, MAX_PER_CHANNEL));
}

export function getSnipe(channelId, index = 0) {
  return (store.get(channelId) || [])[index] || null;
}
