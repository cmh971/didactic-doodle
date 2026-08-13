// !cad / !mdt / !erlc link — hand out clickable buttons to log into the website
// and jump straight to the CAD or MDT, so nobody has to remember the URL.
// Uses PUBLIC_URL (tunnel/domain), read at call-time so it's always current.
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const baseUrl = () => (process.env.PUBLIC_URL || `http://localhost:${process.env.WEB_PORT || 3000}`).replace(/\/$/, '');

const TARGETS = {
  cad: { emoji: '🚨', label: 'Open CAD', title: '🚨 Sentinel CAD — Dispatch', path: (g) => `/cad?guild=${g}` },
  mdt: { emoji: '🖥️', label: 'Open MDT', title: '🖥️ Sentinel MDT — Records', path: (g) => `/mdt?guild=${g}` },
  bodycam: { emoji: '🎥', label: 'Open Bodycam', title: '🎥 Sentinel Bodycam', path: (g) => `/bodycam?guild=${g}` },
  portal: { emoji: '👤', label: 'Open Portal', title: '👤 Sentinel Civilian Portal', path: (g) => `/portal?guild=${g}` },
};

export async function handleErlcLinkCommand(message) {
  const m = /^!(erlc|cad|mdt|bodycam|portal)\b\s*(\w*)/i.exec((message.content || '').trim());
  if (!m || !message.guild) return false;
  const cmd = m[1].toLowerCase();
  const sub = (m[2] || '').toLowerCase();
  // !erlc key → secure private modal to set the ER:LC server key (no slash needed).
  if (cmd === 'erlc' && sub === 'key') {
    if (!message.member?.permissions?.has('ManageGuild')) { await message.reply('🔒 Needs **Manage Server** to set the ER:LC key.').catch(() => {}); return true; }
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('erlc:setkey').setLabel('Set ER:LC Key (private)').setEmoji('🔑').setStyle(ButtonStyle.Primary),
    );
    await message.reply({ content: '🔑 Click below to paste your **ER:LC private-server key** in a private popup — it’s **never shown in chat** and stored AES-256 encrypted. Test after with `/erlc server`.', components: [row] }).catch(() => {});
    return true;
  }
  if (cmd === 'erlc' && sub && sub !== 'link') return false; // leave other `!erlc x` alone

  const BASE = baseUrl();
  const gid = message.guild.id;

  // Which page(s) to feature: !cad → CAD, !mdt → MDT, !erlc → hub (both).
  const target = TARGETS[cmd] || null;
  const embed = new EmbedBuilder()
    .setColor(0x37d0a0)
    .setTitle(target ? target.title : '🚨 Sentinel CAD & Dashboard')
    .setDescription(
      '**1.** Click **🔑 Log in** — it signs you in with Discord.\n' +
      `**2.** Then click **${target ? target.emoji + ' ' + target.label : '🚨 Open CAD'}**.\n\n` +
      'ℹ️ Needs **Manage Server** *or* a department role added with `!cadaccess add @PD`.',
    )
    .setFooter({ text: BASE.replace(/^https?:\/\//, '') });

  // Non-http base (dev) can't use Discord link buttons — send plain links.
  if (!/^https?:\/\//.test(BASE)) {
    const path = target ? target.path(gid) : `/cad-hub?guild=${gid}`;
    await message.reply(`🔑 Log in: ${BASE}/login\n${target ? target.emoji : '🚨'} ${BASE}${path}`).catch(() => {});
    return true;
  }

  const buttons = [
    new ButtonBuilder().setLabel('Log in').setEmoji('🔑').setStyle(ButtonStyle.Link).setURL(`${BASE}/login`),
  ];
  if (target) {
    buttons.push(new ButtonBuilder().setLabel(target.label).setEmoji(target.emoji).setStyle(ButtonStyle.Link).setURL(`${BASE}${target.path(gid)}`));
  } else {
    buttons.push(
      new ButtonBuilder().setLabel('Open CAD').setEmoji('🚨').setStyle(ButtonStyle.Link).setURL(`${BASE}/cad?guild=${gid}`),
      new ButtonBuilder().setLabel('Open MDT').setEmoji('🖥️').setStyle(ButtonStyle.Link).setURL(`${BASE}/mdt?guild=${gid}`),
    );
  }
  buttons.push(new ButtonBuilder().setLabel('Dashboard').setEmoji('🖥️').setStyle(ButtonStyle.Link).setURL(`${BASE}/dashboard`));

  await message.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(buttons)] }).catch(() => {});
  return true;
}
