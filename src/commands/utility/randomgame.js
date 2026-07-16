import { SlashCommandBuilder } from 'discord.js';
import { rint, pick } from '../../util.js';
export const data = new SlashCommandBuilder().setName('randomgame').setDescription("Pick a random game to play");
export async function execute(interaction) { const out = (function () { return '🎮 ' + pick(['UNO','chess','Mario Kart','Minecraft','Among Us','Tetris','Stardew Valley','Rocket League']); })(); await interaction.reply(String(out).slice(0, 1990)); }
