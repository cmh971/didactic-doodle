import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const WYR = [
  'be able to fly OR be invisible?',
  'always draw +4 cards OR never draw a wild?',
  'have unlimited UNO Tokens OR win every game?',
  'fight 100 duck-sized horses OR one horse-sized duck?',
  'never play UNO again OR only play No Mercy mode forever?',
  'be the richest player OR the luckiest player?',
  'have a Timeout Hammer OR a Rob Shield for life?',
  'know the future OR be able to change the past?',
];

export const data = new SlashCommandBuilder().setName('wouldyourather').setDescription('Get a random "would you rather"');

export async function execute(interaction) {
  await interaction.reply(`🤔 Would you rather… ${pick(WYR)}`);
}
