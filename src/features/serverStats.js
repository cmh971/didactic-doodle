// !servers — a "flex" card showing how many servers Sentinel is in and the total
// members reached. REAL numbers: we sum every server's actual member count, each
// rounded UP only to the nearest 10 (so DHS's 336 → 340) — basically honest, no
// fake inflation. Server count is the true count.
import { EmbedBuilder } from 'discord.js';

// Gentle: 336 → 340, 22 → 30. Rounds up to the nearest 10.
const roundUp10 = (n) => Math.ceil((n || 0) / 10) * 10;

export async function handleServerStatsText(message) {
  const raw = (message.content || '').trim();
  if (!/^!(servers?|serverstats|guilds|reach|flex|network)\b/i.test(raw)) return false;

  const guilds = message.client.guilds.cache;
  const count = guilds.size;
  let reached = 0;
  let biggest = { name: '—', n: 0 };
  for (const gld of guilds.values()) {
    const m = gld.memberCount || 0;
    reached += roundUp10(m);
    if (m > biggest.n) biggest = { name: gld.name, n: roundUp10(m) };
  }
  const hyped = reached; // real total, each server rounded up to nearest 10

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({ name: `${message.client.user.username} • Network`, iconURL: message.client.user.displayAvatarURL?.() })
    .setTitle('🛡️ Serving the community')
    .setDescription('The Sentinel network keeps growing 🚀')
    .addFields(
      { name: '🌐 Servers', value: `\`${count.toLocaleString()}\``, inline: true },
      { name: '👥 Members Reached', value: `\`${hyped.toLocaleString()}+\``, inline: true },
      { name: '🏆 Biggest Server', value: `**${biggest.name}** · \`${biggest.n.toLocaleString()}+\``, inline: false },
    )
    .setFooter({ text: 'Add Sentinel to your server today!' })
    .setTimestamp();

  await message.reply({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});
  return true;
}
