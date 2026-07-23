// Interactive /help — browse all 200+ commands by category with ◀️ ▶️ arrows
// and a category jump dropdown. Reads client.commands (set in index.js).
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { listForHelp as listPrefixForHelp, QCAT_META } from '../prefix/index.js';

const ACCENT = 0x5865f2;
const CAT_ORDER = ['core', 'economy', 'gamification', 'moderation', 'utility', 'qtext', 'qmath', 'qfun', 'qutil'];
const CAT_META = {
  core: { emoji: '🛠️', label: 'Core' },
  economy: { emoji: '🪙', label: 'Economy' },
  gamification: { emoji: '🎮', label: 'Fun & Games' },
  moderation: { emoji: '🛡️', label: 'Moderation' },
  utility: { emoji: '🧰', label: 'Utility' },
  ...QCAT_META,
};
const PER_PAGE = 18;

function groupByCategory(client) {
  const groups = {};
  for (const cmd of client.commands.values()) {
    const cat = cmd.category || 'utility';
    (groups[cat] ??= []).push({ name: cmd.data.name, desc: cmd.data.description || '', prefix: '/' });
  }
  // Fold in the "?" prefix command pack so it shows in help too.
  for (const c of listPrefixForHelp()) {
    (groups[c.category] ??= []).push({ name: c.name, desc: c.description || '', prefix: c.prefix });
  }
  for (const list of Object.values(groups)) list.sort((a, b) => a.name.localeCompare(b.name));
  return groups;
}

// Flatten into a linear page list: [overview, ...category chunks].
export function buildPages(client) {
  const groups = groupByCategory(client);
  const cats = [...CAT_ORDER.filter((c) => groups[c]), ...Object.keys(groups).filter((c) => !CAT_ORDER.includes(c))];
  const total = Object.values(groups).reduce((a, l) => a + l.length, 0);
  const pages = [{ overview: true, total, cats, groups }];
  const catStart = {};
  for (const cat of cats) {
    catStart[cat] = pages.length;
    const list = groups[cat];
    for (let i = 0; i < list.length; i += PER_PAGE) {
      pages.push({ cat, items: list.slice(i, i + PER_PAGE), part: Math.floor(i / PER_PAGE) + 1, parts: Math.ceil(list.length / PER_PAGE) });
    }
  }
  return { pages, catStart };
}

export function renderHelp(client, page = 0) {
  const { pages, catStart } = buildPages(client);
  const N = pages.length;
  const idx = ((page % N) + N) % N;
  const p = pages[idx];

  const embed = new EmbedBuilder()
    .setColor(ACCENT)
    .setAuthor({ name: `${client.user.username} • Help`, iconURL: client.user.displayAvatarURL?.() });

  if (p.overview) {
    embed
      .setTitle('📖 Command Help')
      .setDescription(
        `I have **${p.total}** commands! Browse with the ◀️ ▶️ arrows or jump with the menu below.\n\n` +
          p.cats.map((c) => `${CAT_META[c]?.emoji || '•'} **${CAT_META[c]?.label || c}** — ${p.groups[c].length} commands`).join('\n') +
          `\n\n💡 Extras live under hub commands like \`/fun\`, \`/tool\`, \`/eco\`. Categories marked **(?)** are quick **?** commands — type \`?help\` for the full list.`,
      )
      .setFooter({ text: `Page 1 of ${N}` });
  } else {
    const meta = CAT_META[p.cat] || { emoji: '•', label: p.cat };
    embed
      .setTitle(`${meta.emoji} ${meta.label}${p.parts > 1 ? ` (${p.part}/${p.parts})` : ''}`)
      .setDescription(p.items.map((c) => `**${c.prefix || '/'}${c.name}** — ${c.desc}`).join('\n'))
      .setFooter({ text: `Page ${idx + 1} of ${N}` });
  }

  const N2 = N;
  const prev = (idx - 1 + N2) % N2;
  const next = (idx + 1) % N2;
  // custom_id must be unique across the whole message — home uses a dedicated id
  // so it can't collide with prev/next (which reach 0 on the first/last page).
  const nav = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`help:nav:${prev}`).setEmoji('◀️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('help:home').setEmoji('🏠').setLabel(`${idx + 1}/${N2}`).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`help:nav:${next}`).setEmoji('▶️').setStyle(ButtonStyle.Secondary),
  );
  const jump = new StringSelectMenuBuilder()
    .setCustomId('help:jump')
    .setPlaceholder('Jump to a category…')
    .addOptions(
      Object.entries(catStart).map(([cat, start]) => ({
        label: CAT_META[cat]?.label || cat,
        value: String(start),
        emoji: CAT_META[cat]?.emoji,
      })),
    );

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(jump), nav] };
}

export async function handleHelp(interaction) {
  if (!interaction.customId?.startsWith('help:')) return false;
  const parts = interaction.customId.split(':');
  let target;
  if (parts[1] === 'jump') target = Number(interaction.values[0]);
  else if (parts[1] === 'home') target = 0;
  else target = Number(parts[2]);
  await interaction.update(renderHelp(interaction.client, target || 0));
  return true;
}
