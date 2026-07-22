// Prefix (!) fallback for Roblox verification — same flow as /verify:
// run !verify → get a code in your DMs → paste it into your Roblox "About" →
// confirm on the verify page → the bot swaps your roles on success.
import { EmbedBuilder } from 'discord.js';
import { startVerification } from './verification.js';
import { getCfg } from '../setup/store.js';

// Returns true if it handled the message (so the caller stops processing it).
export async function handleVerifyText(message) {
  const raw = (message.content || '').trim().toLowerCase();
  if (raw !== '!verify' && !raw.startsWith('!verify ')) return false;

  const guildId = message.guild.id;
  const userId = message.author.id;

  const vcfg = getCfg(guildId).settings.verify || {};
  if (!vcfg.verifiedRoleId && !vcfg.unverifiedRoleId) {
    await message.reply('⚠️ Verification isn’t set up on this server yet. An admin needs to pick a **verified** role on the dashboard (Verification card) or with `/setup`.').catch(() => {});
    return true;
  }

  const code = startVerification(guildId, userId);
  const base = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
  const link = base ? `${base}/verify?g=${guildId}` : null;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🔐 Roblox Verification')
    .setDescription(
      `Let’s link your Roblox account to **${message.guild.name}**.\n\n` +
      '**1.** Copy your code below and paste it into your Roblox profile **About / Description**, then hit **Save** on Roblox.\n' +
      `\`\`\`${code}\`\`\`\n` +
      `**2.** Open the verification page${link ? ` → ${link}` : ' on the dashboard → **Verify**'}\n` +
      '**3.** Enter your Roblox username, confirm it’s you, and you’re in! ✅\n\n' +
      '_Your code expires in 30 minutes. You can remove it from your profile once verified._',
    )
    .setFooter({ text: 'Sentinel • never share your code with anyone' });

  const dm = await message.author.createDM().then((c) => c.send({ embeds: [embed] }).then(() => true)).catch(() => false);

  // Keep the code private — never echo it into the channel.
  if (dm) await message.reply('📬 Check your DMs — I sent you a verification code and a link.').catch(() => {});
  else await message.reply('📪 I couldn’t DM you. Please enable **Direct Messages** from server members (Privacy Settings) and run `!verify` again.').catch(() => {});
  return true;
}
