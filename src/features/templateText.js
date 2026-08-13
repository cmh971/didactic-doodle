// !template — actually USE the templates you design at /templates.
//   !template list            → show saved templates
//   !template send <name>     → render it (filling all 60 variables) and post it
//   !template send <name> @user → fill {user}/{user.*} vars from that member
// Closes the loop on the template builder. Needs Manage Server to send.
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getTemplates, renderTemplate } from './templates.js';

export async function handleTemplateText(message) {
  const raw = (message.content || '').trim();
  if (!/^!(template|tpl)\b/i.test(raw)) return false;
  if (!message.guild) { await message.reply('Use `!template` inside a server.').catch(() => {}); return true; }

  const tokens = raw.split(/\s+/);
  const sub = (tokens[1] || '').toLowerCase();
  const templates = getTemplates(message.guild.id);

  if (sub === 'list' || !sub) {
    if (!templates.length) { await message.reply('📭 No templates yet — build one at **sentinelbothq.com/templates**.').catch(() => {}); return true; }
    const lines = templates.map((t) => `• **${t.name}** \`${t.type}\``).join('\n');
    await message.reply(`🧩 **Saved templates** (${templates.length})\n${lines}\n\n_Send one with_ \`!template send <name>\``).catch(() => {});
    return true;
  }

  if (sub === 'send') {
    if (!message.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      await message.reply('🔒 You need **Manage Server** to send templates.').catch(() => {});
      return true;
    }
    const name = tokens.slice(2).filter((t) => !/^<@!?\d+>$/.test(t)).join(' ').trim();
    if (!name) { await message.reply('Usage: `!template send <name>` (see `!template list`).').catch(() => {}); return true; }
    const tpl = templates.find((t) => t.name.toLowerCase() === name.toLowerCase()) || templates.find((t) => t.id === name);
    if (!tpl) { await message.reply(`❌ No template named **${name}**. Try \`!template list\`.`).catch(() => {}); return true; }

    // Build the variable context from this message.
    const target = message.mentions.users.first() || message.author;
    const targetMember = await message.guild.members.fetch(target.id).catch(() => null);
    const ctx = { guild: message.guild, target, targetMember, mod: message.author, modMember: message.member, channel: message.channel };

    const body = renderTemplate(tpl.content, ctx).slice(0, 4096);
    const title = tpl.title ? renderTemplate(tpl.title, ctx).slice(0, 256) : '';
    const isEmbed = Boolean(title || tpl.color || tpl.image);

    try {
      if (isEmbed) {
        const embed = new EmbedBuilder().setDescription(body || ' ');
        if (title) embed.setTitle(title);
        if (/^#?[0-9a-f]{6}$/i.test(tpl.color || '')) embed.setColor(parseInt(tpl.color.replace('#', ''), 16));
        if (/^https?:\/\//.test(tpl.image || '')) embed.setImage(tpl.image);
        await message.channel.send({ embeds: [embed], allowedMentions: { parse: ['users', 'roles', 'everyone'] } });
      } else {
        await message.channel.send({ content: body.slice(0, 2000) || '(empty template)', allowedMentions: { parse: ['users', 'roles', 'everyone'] } });
      }
      await message.delete().catch(() => {});
    } catch (e) {
      await message.reply(`⚠️ Couldn't send: ${e.message}`).catch(() => {});
    }
    return true;
  }

  await message.reply('🧩 **Templates** — `!template list` · `!template send <name>` · design them at sentinelbothq.com/templates').catch(() => {});
  return true;
}
