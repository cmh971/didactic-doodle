import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { ensureCommunity, updateCommunity } from '../../community/store.js';

export const data = new SlashCommandBuilder()
  .setName('setprofile')
  .setDescription('Edit your community web page (syncs to the dashboard live)')
  .addStringOption((o) => o.setName('title').setDescription('Community title'))
  .addStringOption((o) => o.setName('color').setDescription('Theme color hex, e.g. #ff0000'))
  .addStringOption((o) => o.setName('welcome').setDescription('Home page text (markdown)'))
  .addStringOption((o) => o.setName('customid').setDescription('Custom URL id (e.g. gamers-club)'))
  .addBooleanOption((o) => o.setName('verification').setDescription('Require Cloud Fair verification'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  if (!interaction.inGuild()) return interaction.reply({ content: '❌ Use this in a server.', flags: MessageFlags.Ephemeral });
  ensureCommunity(interaction.guildId, interaction.guild.name);

  const patch = {};
  const title = interaction.options.getString('title');
  const color = interaction.options.getString('color');
  const welcome = interaction.options.getString('welcome');
  const customId = interaction.options.getString('customid');
  const verification = interaction.options.getBoolean('verification');

  if (title) patch.communityName = title.slice(0, 80);
  if (welcome) patch.homePageMarkdown = welcome.slice(0, 2000);
  if (verification !== null) patch.verificationRequired = verification;
  if (customId) patch.customSubdomainOrId = customId.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40);
  if (color) {
    const hex = color.startsWith('#') ? color : `#${color}`;
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return interaction.reply({ content: '❌ Color must be hex like `#ff0000`.', flags: MessageFlags.Ephemeral });
    patch.themeColor = hex;
  }

  const cfg = updateCommunity(interaction.guildId, patch); // mutates DB + emits live update
  const base = process.env.DASHBOARD_URL || `http://localhost:${process.env.WEB_PORT || 3000}`;
  const embed = new EmbedBuilder()
    .setColor(cfg.themeColor)
    .setTitle('✅ Community profile updated')
    .setDescription(
      `**${cfg.communityName}**\n${cfg.homePageMarkdown.slice(0, 200)}\n\n` +
        `🎨 ${cfg.themeColor} · 🛡️ Verification: ${cfg.verificationRequired ? 'on' : 'off'} · ` +
        `${cfg.isApproved ? '✓ approved' : '⏳ pending approval'}\n🔗 ${base}/c/${cfg.customSubdomainOrId}`,
    );
  await interaction.reply({ embeds: [embed] });
}
