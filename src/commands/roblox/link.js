import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { resolveRoblox, startVerify, completeVerify, getLink, unlink } from '../../features/roblox.js';

const eph = (content) => ({ content, flags: MessageFlags.Ephemeral });

export const data = new SlashCommandBuilder()
  .setName('link')
  .setDescription('Link or unlink your Roblox account')
  .addSubcommand((s) => s.setName('start').setDescription('Begin linking a Roblox account').addStringOption((o) => o.setName('username').setDescription('Roblox username').setRequired(true)))
  .addSubcommand((s) => s.setName('verify').setDescription('Finish linking after adding the code to your profile'))
  .addSubcommand((s) => s.setName('unlink').setDescription('Unlink your Roblox account'));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const g = interaction.guildId;
  const u = interaction.user.id;

  if (sub === 'unlink') {
    unlink(g, u);
    return interaction.reply(eph('🔓 Your Roblox account has been unlinked.'));
  }

  if (sub === 'start') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const rbx = await resolveRoblox(interaction.options.getString('username'));
    if (!rbx) return interaction.editReply('❌ Could not find that Roblox user.');
    const code = startVerify(g, u, rbx.id, rbx.name);
    return interaction.editReply(
      `🔗 Linking **${rbx.name}** (ID ${rbx.id}).\n` +
        `1. Put this code in your Roblox profile **About/Description**:\n\`\`\`${code}\`\`\`\n` +
        `2. Then run **/link verify**.`,
    );
  }

  // verify
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const r = await completeVerify(g, u);
  if (!r.ok) return interaction.editReply(`❌ ${r.reason}`);
  // Best-effort: set their nickname to the Roblox name.
  await interaction.member?.setNickname?.(r.name).catch(() => {});
  return interaction.editReply(`✅ Verified! Linked to **${r.name}**. You can remove the code from your profile now.`);
}
