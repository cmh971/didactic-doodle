import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { isPremium, getPremium, grantPremium, revokePremium, PREMIUM_PERKS } from '../../systems/premium.js';

const eph = (content) => ({ content, flags: MessageFlags.Ephemeral });
const owners = () => (process.env.OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);

export const data = new SlashCommandBuilder()
  .setName('premium')
  .setDescription('View or manage this server\'s premium status')
  .addSubcommand((s) => s.setName('status').setDescription('Show premium status & perks'))
  .addSubcommand((s) =>
    s.setName('grant').setDescription('(Owner) Grant premium to this server').addIntegerOption((o) => o.setName('days').setDescription('Days (0 = lifetime)')),
  )
  .addSubcommand((s) => s.setName('revoke').setDescription('(Owner) Revoke premium from this server'));

export async function execute(interaction) {
  if (!interaction.inGuild()) return interaction.reply(eph('❌ Use this in a server.'));
  const sub = interaction.options.getSubcommand();

  if (sub === 'grant' || sub === 'revoke') {
    if (!owners().includes(interaction.user.id)) return interaction.reply(eph('🔒 Only a bot owner can manage premium.'));
    if (sub === 'grant') {
      const days = interaction.options.getInteger('days') ?? 30;
      const p = grantPremium(interaction.guildId, days);
      return interaction.reply(`💎 Premium **granted** to this server${p.until ? ` until <t:${Math.floor(p.until / 1000)}:D>` : ' (lifetime)'}!`);
    }
    revokePremium(interaction.guildId);
    return interaction.reply('💎 Premium revoked from this server.');
  }

  const active = isPremium(interaction.guildId);
  const p = getPremium(interaction.guildId);
  const embed = new EmbedBuilder()
    .setColor(active ? 0xffd23f : 0x95a5a6)
    .setTitle(active ? '💎 Premium Active' : '🔓 Free Tier')
    .setDescription(
      (active
        ? `This server has **Premium**${p.until ? ` until <t:${Math.floor(p.until / 1000)}:D>` : ' (lifetime)'}! Enjoy:`
        : 'Unlock more with **Premium**:') +
        '\n\n' + PREMIUM_PERKS.join('\n'),
    )
    .setFooter({ text: active ? 'Thanks for supporting the bot! 💛' : 'Ask a bot owner to enable premium.' });
  await interaction.reply({ embeds: [embed] });
}
