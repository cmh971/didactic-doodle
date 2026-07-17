import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { addEmojiToGuild, listBundledEmojis, bundledEmojiNames, bundledEmojiPath } from '../../features/emojis.js';

// The bundled presets become dropdown choices at startup (max 25).
const presetChoices = listBundledEmojis().slice(0, 25).map((e) => ({ name: e.name + (e.animated ? ' (animated)' : ''), value: e.name }));

export const data = new SlashCommandBuilder()
  .setName('emoji')
  .setDescription('Add a custom emoji to this server')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuildExpressions)
  .addSubcommand((s) => s.setName('add').setDescription('Add an emoji from an image (PNG or animated GIF)')
    .addStringOption((o) => o.setName('name').setDescription('Emoji name').setRequired(true))
    .addAttachmentOption((o) => o.setName('image').setDescription('Image file — GIF = animated emoji'))
    .addStringOption((o) => o.setName('url').setDescription('…or an image/GIF URL')))
  .addSubcommand((s) => {
    s.setName('preset').setDescription('Add one of the bundled emojis')
      .addStringOption((o) => {
        o.setName('preset').setDescription('Which bundled emoji').setRequired(true);
        if (presetChoices.length) o.addChoices(...presetChoices);
        return o;
      })
      .addStringOption((o) => o.setName('name').setDescription('Custom name (defaults to the preset name)'));
    return s;
  });

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    if (sub === 'add') {
      const name = interaction.options.getString('name');
      const source = interaction.options.getAttachment('image')?.url || interaction.options.getString('url');
      if (!source) return interaction.editReply('❌ Provide an image attachment or a URL.');
      const e = await addEmojiToGuild(interaction.guild, name, source);
      return interaction.editReply(`✅ Added ${e} — \`:${e.name}:\``);
    }
    const preset = interaction.options.getString('preset');
    if (!bundledEmojiNames().includes(preset)) return interaction.editReply(`❌ Unknown preset "${preset}".`);
    const name = interaction.options.getString('name') || preset;
    const e = await addEmojiToGuild(interaction.guild, name, bundledEmojiPath(preset));
    return interaction.editReply(`✅ Added ${e} — \`:${e.name}:\``);
  } catch (err) {
    return interaction.editReply(`❌ Could not add emoji: ${err.message}`);
  }
}
