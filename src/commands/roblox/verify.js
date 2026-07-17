import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { startVerification } from '../../features/verification.js';
import { getCfg } from '../../setup/store.js';

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

  const dm = await interaction.user.createDM().then((c) => c.send({ embeds: [embed] }).then(() => true)).catch(() => false);
  if (dm) return interaction.reply(eph('📬 Check your DMs — I sent you a verification code and a link.'));

  // DMs closed: hand the code back ephemerally so they can still verify.
  return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
