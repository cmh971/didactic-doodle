import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const FACTS = [
  'UNO was invented in 1971 by Merle Robbins, a barber from Ohio.',
  'A standard UNO deck has 108 cards.',
  'Honey never spoils — edible after 3,000 years.',
  'Octopuses have three hearts and blue blood.',
  'Bananas are berries, but strawberries are not.',
  'A group of flamingos is called a "flamboyance".',
  'The Eiffel Tower can grow over 15 cm taller in summer.',
  'There are more possible UNO game states than atoms you\'d care to count.',
];

export const data = new SlashCommandBuilder().setName('fact').setDescription('Get a random fun fact');

export async function execute(interaction) {
  await interaction.reply(`🧠 ${pick(FACTS)}`);
}
