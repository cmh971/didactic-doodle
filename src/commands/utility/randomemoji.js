import { SlashCommandBuilder } from 'discord.js';
import { rint, pick } from '../../util.js';

export const data = new SlashCommandBuilder().setName('randomemoji').setDescription("Get a random emoji");

export async function execute(interaction) {
  const out = (function () { return pick(['😀','🦄','🍕','🚀','🐙','🎲','🔥','🌈','👾','🍩','🐸','⚡','🎸','🦖','🍔','🛸']); })();
  await interaction.reply(String(out).slice(0, 1990));
}
