// !asteroid / !spacehazard — renders a 3D-ish "approach" scene showing how close
// today's near-Earth asteroids pass, relative to Earth and the Moon's orbit.
import { EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { getNeo } from './funApis.js';
import { renderAsteroidApproach } from './apiCards.js';

const cooldown = new Map();
const COOLDOWN = 15000; // canvas render is heavy — cap per user

export async function handleSpaceHazardText(message) {
  const raw = (message.content || '').trim();
  if (!/^!(asteroid|spacehazard|neo3d|approach)\b/i.test(raw)) return false;

  const last = cooldown.get(message.author.id) || 0;
  if (Date.now() - last < COOLDOWN) {
    await message.reply(`⏳ Give it ${Math.ceil((COOLDOWN - (Date.now() - last)) / 1000)}s.`).catch(() => {});
    return true;
  }
  cooldown.set(message.author.id, Date.now());

  const arg = raw.split(/\s+/)[1] || '';
  try {
    const data = await getNeo(/^\d{4}-\d{2}-\d{2}$/.test(arg) ? arg : '');
    if (!data.objects.length) { await message.reply(`☄️ No tracked near-Earth objects for **${data.date}**.`).catch(() => {}); return true; }

    const closest = data.objects.slice().sort((a, b) => a.missLunar - b.missLunar)[0];
    const haz = data.objects.filter((o) => o.hazardous).length;
    const buf = renderAsteroidApproach(data);
    const embed = new EmbedBuilder()
      .setColor(haz ? 0xe74c3c : 0x3fa7ff)
      .setTitle(`☄️ Near-Earth Approach — ${data.date}`)
      .setDescription(
        `**${data.count}** objects tracked${haz ? ` · ⚠️ **${haz}** potentially hazardous` : ' · none hazardous 🟢'}\n\n` +
        `**Closest:** ${closest.name} — **${closest.missLunar.toFixed(1)} LD** away ` +
        `(${closest.missKm.toLocaleString()} km) · Ø ${closest.diaMin}–${closest.diaMax} m · ${closest.velocityKmh.toLocaleString()} km/h`,
      )
      .setImage('attachment://approach.png')
      .setFooter({ text: 'NASA NeoWs · LD = Lunar Distances (1 LD ≈ 384,400 km)' });
    await message.reply({ embeds: [embed], files: [new AttachmentBuilder(buf, { name: 'approach.png' })] }).catch(() => {});
  } catch (e) {
    await message.reply(`⚠️ Couldn't load asteroid data: ${e.message}`).catch(() => {});
  }
  return true;
}
