import { SlashCommandBuilder } from 'discord.js';
import { addWallet, balance, checkCooldown, setCooldown } from '../../economy/store.js';
import { eph, fmtDuration, pick, rint } from '../../util.js';
import { renderShip } from '../../render/extras.js';
import { TOKEN } from '../../config.js';

const COOLDOWN = 5 * 60 * 1000; // 5 min between voyages

// destination -> { reward range, danger 0..1, label }
const ROUTES = {
  coast: { name: 'Coastal Run', min: 20_000, max: 80_000, danger: 0.2, distance: 3 },
  islands: { name: 'Island Trade', min: 80_000, max: 250_000, danger: 0.4, distance: 5 },
  highseas: { name: 'High Seas Expedition', min: 250_000, max: 900_000, danger: 0.65, distance: 7 },
};

// random voyage events: [text, tokenDelta fn(base), weather?]
const EVENTS = [
  { t: '🌊 Smooth sailing under clear skies.', f: (b) => Math.round(b * 0.1), w: 'calm' },
  { t: '💨 Caught the trade winds — made great time!', f: (b) => Math.round(b * 0.25), w: 'calm' },
  { t: '🏝️ Found a hidden cove with extra cargo.', f: (b) => Math.round(b * 0.4), w: 'sunset' },
  { t: '💰 Discovered a sunken treasure chest!', f: (b) => Math.round(b * 0.8), w: 'sunset' },
  { t: '🐬 A pod of dolphins escorted you — good luck!', f: (b) => Math.round(b * 0.15), w: 'calm' },
  { t: '⛈️ A storm battered the hull — repairs cost you.', f: (b) => -Math.round(b * 0.4), w: 'storm' },
  { t: '🏴‍☠️ Pirates raided your cargo!', f: (b) => -Math.round(b * 0.6), w: 'storm' },
  { t: '🦑 A sea monster surfaced — you barely escaped.', f: (b) => -Math.round(b * 0.5), w: 'night' },
  { t: '🌫️ Lost in the fog and drifted off course.', f: (b) => -Math.round(b * 0.2), w: 'night' },
];

export const data = new SlashCommandBuilder()
  .setName('ship')
  .setDescription('⛵ Ship sim: sail a voyage, brave the seas, and earn UNO Tokens')
  .addStringOption((o) =>
    o.setName('destination').setDescription('Where to sail').addChoices(
      { name: 'Coastal Run (safe, small payout)', value: 'coast' },
      { name: 'Island Trade (medium risk/reward)', value: 'islands' },
      { name: 'High Seas Expedition (dangerous, huge payout)', value: 'highseas' },
    ),
  );

export async function execute(interaction) {
  const routeKey = interaction.options.getString('destination') ?? 'coast';
  const route = ROUTES[routeKey];
  const userId = interaction.user.id;

  const left = checkCooldown(userId, 'ship', COOLDOWN);
  if (left) return interaction.reply(eph(`⚓ Your crew is resting in port. Set sail again in **${fmtDuration(left)}**.`));
  setCooldown(userId, 'ship');

  await interaction.deferReply();

  // base cargo value for this voyage
  const base = rint(route.min, route.max);

  // simulate the voyage event-by-event
  const log = [];
  let net = base; // start with the cargo's sale value
  let lastWeather = 'calm';
  let wrecked = false;

  log.push(`⛵ **${route.name}** — cargo valued at ${TOKEN} ${base.toLocaleString()}.`);
  for (let leg = 0; leg < route.distance; leg++) {
    // danger gate: only roll a bad event with route danger probability
    const pool = Math.random() < route.danger ? EVENTS : EVENTS.filter((e) => e.f(100) >= 0);
    const ev = pick(pool);
    const delta = ev.f(base);
    net += delta;
    lastWeather = ev.w;
    const sign = delta >= 0 ? `+${TOKEN} ${delta.toLocaleString()}` : `-${TOKEN} ${Math.abs(delta).toLocaleString()}`;
    log.push(`${ev.t} (${sign})`);
    if (net <= 0) {
      wrecked = true;
      net = 0;
      log.push('🛟 The ship was lost! You return to port empty-handed.');
      break;
    }
  }

  // settle: net minus the cargo's original value = profit/loss vs an empty trip
  const wallet = balance(userId).wallet;
  let payout = net;
  if (wrecked) {
    // a wreck costs a small insurance fee
    payout = -Math.min(wallet, Math.round(base * 0.2));
  }
  addWallet(userId, payout);

  const title = wrecked
    ? '🛟 Shipwrecked!'
    : payout >= base
      ? '🏆 Voyage Profit!'
      : '⚓ Made it to port';
  const weather = wrecked ? 'storm' : lastWeather;
  const tilt = weather === 'storm' ? rint(-8, 8) : rint(-3, 3);

  const summary = wrecked
    ? `You lost ${TOKEN} **${Math.abs(payout).toLocaleString()}** in insurance fees.`
    : `You docked with ${TOKEN} **${payout.toLocaleString()}**! New balance: ${TOKEN} ${balance(userId).wallet.toLocaleString()}.`;

  await interaction.editReply({
    content: `${log.join('\n')}\n\n**${title}** ${summary}`,
    files: [renderShip({ weather, title, tilt })],
  });
}
