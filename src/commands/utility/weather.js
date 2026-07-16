import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getWeather, weatherEmoji } from '../../features/weather.js';

export const data = new SlashCommandBuilder()
  .setName('weather')
  .setDescription('Get the current weather for a location')
  .addStringOption((o) => o.setName('location').setDescription('City name, e.g. London or "New York, US"').setRequired(true))
  .addStringOption((o) => o.setName('units').setDescription('Temperature units')
    .addChoices({ name: 'Celsius (°C)', value: 'metric' }, { name: 'Fahrenheit (°F)', value: 'imperial' }));

export async function execute(interaction) {
  const location = interaction.options.getString('location');
  const units = interaction.options.getString('units') || 'metric';
  await interaction.deferReply();

  const r = await getWeather(location, units);
  if (!r.ok) return interaction.editReply(`❌ ${r.error}`);

  const d = r.data;
  const u = units === 'imperial' ? '°F' : '°C';
  const ws = units === 'imperial' ? 'mph' : 'm/s';
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`${weatherEmoji(d.icon || d.main)} Weather in ${d.name}${d.country ? ', ' + d.country : ''}`)
    .setThumbnail(d.icon ? `https://openweathermap.org/img/wn/${d.icon}@2x.png` : null)
    .setDescription(`**${d.temp}${u}** — ${d.desc}`)
    .addFields(
      { name: '🌡️ Feels like', value: `${d.feels}${u}`, inline: true },
      { name: '⬇️⬆️ Min / Max', value: `${d.min}${u} / ${d.max}${u}`, inline: true },
      { name: '💧 Humidity', value: `${d.humidity}%`, inline: true },
      { name: '💨 Wind', value: `${d.wind} ${ws}`, inline: true },
      { name: '☁️ Clouds', value: `${d.clouds}%`, inline: true },
      { name: '📊 Pressure', value: `${d.pressure} hPa`, inline: true },
    )
    .setFooter({ text: 'Powered by OpenWeather' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
