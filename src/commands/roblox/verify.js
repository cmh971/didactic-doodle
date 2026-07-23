import { SlashCommandBuilder, EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { startVerification } from '../../features/verification.js';
import { getCfg } from '../../setup/store.js';

// Build the "copy" button row. Discord buttons can't touch the clipboard, so
// these are LINK buttons that open our /copy page — it copies the code/link to
// the clipboard, flashes "Copied!", then deep-links back into Discord.
export function buildVerifyButtons(base, code, link) {
  if (!base) return []; // no public URL configured → no link buttons possible
  const copyUrl = (type) =>
    `${base}/copy.html?type=${type}&code=${encodeURIComponent(code)}&link=${encodeURIComponent(link || '')}&return=dm`;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Link).setEmoji('📋').setLabel('Copy Code').setURL(copyUrl('code')),
  );
  if (link) {
    row.addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setEmoji('🔗').setLabel('Copy Link').setURL(copyUrl('link')),
      new ButtonBuilder().setStyle(ButtonStyle.Link).setEmoji('🌐').setLabel('Verify Page').setURL(link),
    );
  }
  return [row];
}

const eph = (content) => ({ content, flags: MessageFlags.Ephemeral });

export const data = new SlashCommandBuilder()
  .setName('verify')
  .setDescription('Verify your Roblox account to unlock the server')
  .setDMPermission(false);

export async function execute(interaction) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  const vcfg = getCfg(guildId).settings.verify || {};
  if (!vcfg.verifiedRoleId && !vcfg.unverifiedRoleId) {
    return interaction.reply(eph('⚠️ Verification isn\'t set up on this server yet. An admin needs to pick a **verified** role on the dashboard (Verification card) or with `/setup`.'));
  }

  const code = startVerification(guildId, userId);
  const base = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
  const link = base ? `${base}/verify?g=${guildId}` : null;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🔐 Roblox Verification')
    .setDescription(
      `Let\'s link your Roblox account to **${interaction.guild.name}**.\n\n` +
        '**1.** Copy your code below and paste it into your Roblox profile **About / Description**, then hit **Save** on Roblox.\n' +
        `\`\`\`${code}\`\`\`\n` +
        `**2.** Open the verification page${link ? ` → ${link}` : ' on the dashboard → **Verify**'}\n` +
        '**3.** Enter your Roblox username, confirm it\'s you, and you\'re in! ✅\n\n' +
        '_Your code expires in 30 minutes. You can remove it from your profile once verified._',
    )
    .setFooter({ text: 'Sentinel • never share your code with anyone' });

  const components = buildVerifyButtons(base, code, link);
  const dm = await interaction.user.createDM().then((c) => c.send({ embeds: [embed], components }).then(() => true)).catch(() => false);
  if (dm) return interaction.reply(eph('📬 Check your DMs — I sent you a verification code, a link, and a one-tap **Copy Code** button.'));

  // DMs closed: hand the code back ephemerally so they can still verify.
  return interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
}
