// Per-server bot profile (avatar + banner). Uses Discord's "Modify Current Member"
// endpoint (PATCH /guilds/{id}/members/@me), which sets the bot's picture/banner in
// ONE guild only — the global avatar is untouched. Pass a falsy url to reset.
//
// NOTE: Discord bots do NOT have a per-server BIO — the bio ("About Me") is global,
// set on the application. Only nickname, avatar, and banner are per-server.
import { Routes } from 'discord.js';

async function fetchDataUri(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not fetch that image URL.');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 10 * 1024 * 1024) throw new Error('Image is too large (max 10 MB).');
  const type = res.headers.get('content-type') || 'image/png';
  if (!/^image\//.test(type)) throw new Error('That URL is not an image.');
  return `data:${type};base64,${buf.toString('base64')}`;
}

export async function setGuildAvatar(guild, url) {
  const avatar = url ? await fetchDataUri(url) : null;
  await guild.client.rest.patch(Routes.guildMember(guild.id, '@me'), { body: { avatar } });
}

export async function setGuildBanner(guild, url) {
  const banner = url ? await fetchDataUri(url) : null;
  await guild.client.rest.patch(Routes.guildMember(guild.id, '@me'), { body: { banner } });
}
