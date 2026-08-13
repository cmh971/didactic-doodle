// !afk — classic AFK system (a Ducky feature Sentinel was missing).
//   !afk [reason]  → mark yourself away
// When you're mentioned, the bot tells people you're AFK + why. The moment you
// send a message again, it clears your AFK and welcomes you back.
// State is in-memory (AFK is ephemeral — fine to reset on restart).
const afk = new Map(); // userId -> { reason, since }

// The command: set yourself AFK. Returns true if it handled the message.
export async function handleAfkCommand(message) {
  const raw = (message.content || '').trim();
  if (!/^!afk\b/i.test(raw)) return false;
  if (!message.guild) return false;
  const reason = raw.replace(/^!afk\b/i, '').trim().slice(0, 300) || 'AFK';
  afk.set(message.author.id, { reason, since: Date.now() });
  await message.reply(`💤 You're now **AFK** — ${reason}. I'll let people know if they ping you.`).catch(() => {});
  return true;
}

// Passive check on every message: clear the author's AFK, and flag mentioned
// AFK users. Never stops the handler chain (returns nothing).
export async function checkAfk(message) {
  if (message.author?.bot || !message.guild) return;
  const content = message.content || '';

  // Clear the author's own AFK when they talk (but not the message that set it).
  if (afk.has(message.author.id) && !/^!afk\b/i.test(content)) {
    const { since } = afk.get(message.author.id);
    afk.delete(message.author.id);
    const mins = Math.max(1, Math.round((Date.now() - since) / 60000));
    message.reply(`👋 Welcome back — you were AFK for **${mins} min**.`).catch(() => {});
  }

  // Notify about any mentioned users who are AFK.
  const mentioned = message.mentions?.users;
  if (mentioned?.size) {
    const notes = [];
    for (const u of mentioned.values()) {
      if (u.id === message.author.id) continue;
      const a = afk.get(u.id);
      if (a) notes.push(`💤 **${u.username}** is AFK: ${a.reason} · <t:${Math.floor(a.since / 1000)}:R>`);
    }
    if (notes.length) message.reply({ content: notes.join('\n').slice(0, 2000), allowedMentions: { parse: [] } }).catch(() => {});
  }
}
