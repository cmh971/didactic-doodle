// One-off generator that emits real, functional command modules so the bot
// reaches 200 commands. Re-runnable & idempotent (skips files that exist).
// Run: node scripts/genCommands.mjs
import { writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CMD = join(__dirname, '..', 'src', 'commands');

// existing command names (so we never collide)
const existing = new Set();
for (const cat of readdirSync(CMD, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  for (const f of readdirSync(join(CMD, cat.name)).filter((f) => f.endsWith('.js'))) {
    existing.add(f.replace(/\.js$/, ''));
  }
}

let written = 0;
const used = new Set(existing);
function emit(cat, name, body) {
  if (used.has(name)) return;
  used.add(name);
  const dir = join(CMD, cat);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.js`), body);
  written++;
}

// ---------- 1) PICK commands (random line from a list) ----------
const PICKS = {
  fortune: ['A pleasant surprise is waiting for you.', 'Your hard work will soon pay off.', 'Adventure is on the horizon.', 'A good time to start something new.', 'Luck favors you today.'],
  wisdom: ['Patience is a tree whose root is bitter but fruit sweet.', 'The best time to plant a tree was 20 years ago. The second best is now.', 'A river cuts rock not by power but persistence.', 'Fall seven times, stand up eight.', 'Knowing yourself is the beginning of all wisdom.'],
  affirmation: ['You are capable of amazing things.', 'You are enough, exactly as you are.', 'Your potential is limitless.', 'You handle challenges with grace.', 'Good things are coming your way.'],
  motivate: ['Push yourself, because no one else will do it for you.', 'Great things never came from comfort zones.', 'Dream it. Wish it. Do it.', 'Little progress each day adds up to big results.', 'Don\'t stop until you\'re proud.'],
  hype: ['LET\'S GOOOO! 🔥', 'You\'re built different! 💪', 'Absolute legend behavior! 🏆', 'Unstoppable today! ⚡', 'Main character energy! 🌟'],
  bored: ['Try a 5-minute doodle challenge.', 'Learn to say "hello" in a new language.', 'Reorganize one drawer.', 'Start a quick UNO game with `/uno new`!', 'Text someone you haven\'t in a while.'],
  activity: ['Go for a 10-minute walk.', 'Do 20 jumping jacks.', 'Write down 3 things you\'re grateful for.', 'Tidy your desk.', 'Stretch for 2 minutes.'],
  neverhaveiever: ['…stayed up all night gaming.', '…rage quit a board game.', '…eaten cereal for dinner.', '…pretended to be busy to avoid someone.', '…laughed at the wrong moment.'],
  paranoia: ['Who here would survive a zombie apocalypse?', 'Who is most likely to become famous?', 'Who would win in a debate?', 'Who has the best taste in music?', 'Who is secretly a genius?'],
  conspiracy: ['Birds are government drones. 🐦', 'The moon is closer than they say. 🌙', 'Pigeons file taxes. 📁', 'Wi-Fi is just very small ghosts. 👻', 'Mondays are a social construct. 📅'],
  excuse: ['My homework was abducted by aliens.', 'The dog learned to use the shredder.', 'Mercury was in retrograde.', 'I was helping a turtle cross the road.', 'My alarm betrayed me.'],
  prediction: ['You\'ll find money in an old pocket soon.', 'A pleasant message is coming your way.', 'You\'ll win your next UNO game.', 'Today is your lucky color day.', 'Someone is thinking about you.'],
  horoscope: ['The stars say: take a risk today.', 'Cosmic energy favors bold moves.', 'A calm day rewards patience.', 'Trust your gut this afternoon.', 'Good fortune flows toward you.'],
  spacefact: ['A day on Venus is longer than its year.', 'Neutron stars can spin 600 times per second.', 'There are more stars than grains of sand on Earth.', 'Jupiter\'s Great Red Spot is a storm older than telescopes.', 'Space is completely silent.'],
  catfact: ['Cats sleep 13–16 hours a day.', 'A group of cats is called a clowder.', 'Cats have 32 muscles in each ear.', 'A cat\'s purr vibrates at a healing frequency.', 'Cats can\'t taste sweetness.'],
  dogfact: ['Dogs\' noses are as unique as fingerprints.', 'A greyhound can beat a cheetah over long distances.', 'Dogs dream like humans do.', 'Puppies are born deaf.', 'A dog\'s sense of smell is up to 100,000× ours.'],
  historyfact: ['Oxford University is older than the Aztec Empire.', 'Cleopatra lived closer to the Moon landing than to the pyramids.', 'The Eiffel Tower was meant to be temporary.', 'Ancient Romans used crushed mouse brains as toothpaste.', 'Vikings used melted snow to navigate.'],
  pun: ['I used to be a banker but I lost interest.', 'Time flies like an arrow; fruit flies like a banana.', 'I\'m reading a book on anti-gravity — can\'t put it down.', 'Broken pencils are pointless.', 'I wondered why the ball kept getting bigger. Then it hit me.'],
  knockknock: ['Knock knock! / Who\'s there? / Lettuce. / Lettuce who? / Lettuce in, it\'s cold!', 'Knock knock! / Who\'s there? / Boo. / Boo who? / Don\'t cry, it\'s just a joke!', 'Knock knock! / Who\'s there? / Tank. / Tank who? / You\'re welcome!'],
  oneliner: ['I told my computer I needed a break, and it said "no problem — I\'ll go to sleep."', 'I\'m on a seafood diet. I see food and I eat it.', 'Parallel lines have so much in common; shame they\'ll never meet.', 'I have a joke about chemistry, but I don\'t think it\'ll get a reaction.'],
  lifehack: ['Use a binder clip to organize cables.', 'Microwave a lemon before juicing for more juice.', 'Put your phone on airplane mode to charge faster.', 'Use a dab of toothpaste to clean foggy headlights.', 'Freeze grapes to chill wine without watering it down.'],
  starter: ['What\'s a hill you\'ll die on?', 'If you had unlimited UNO Tokens, what\'s the first thing you\'d buy?', 'What\'s the best meal you\'ve ever had?', 'Cats or dogs — defend your answer.', 'What\'s your most-replayed song?'],
  debate: ['Is a hotdog a sandwich?', 'Does pineapple belong on pizza?', 'Is cereal a soup?', 'Is water wet?', 'Should you put milk or cereal first?'],
  hottake: ['Mondays aren\'t that bad.', 'Mild salsa is underrated.', 'Movies are too long now.', 'Cold pizza > hot pizza.', 'Texting back fast is a green flag.'],
  unpopular: ['Sandwiches taste better cut diagonally.', 'Audiobooks count as reading.', 'Winter is the best season.', 'Tomatoes are a fruit AND a vegetable.', 'Group projects can be fun.'],
  vibecheck: ['Vibe: immaculate ✨', 'Vibe: chaotic good 😈', 'Vibe: sleepy but happy 😴', 'Vibe: main character 🌟', 'Vibe: gremlin mode 🦝'],
  complimentme: ['You have impeccable taste.', 'Your energy is contagious.', 'You\'re sharper than you think.', 'People feel better around you.', 'You\'re doing great — really.'],
  riddle: ['What has keys but no locks? || A piano. ||', 'What gets wetter the more it dries? || A towel. ||', 'What has hands but can\'t clap? || A clock. ||', 'What can travel the world while staying in a corner? || A stamp. ||'],
  advice: ['Drink some water right now.', 'Say the thing you\'ve been putting off.', 'Sleep on big decisions.', 'Back up your files today.', 'Be kind; everyone\'s fighting something.'],
  dadjoke: ['I\'m afraid for the calendar. Its days are numbered.', 'Why don\'t eggs tell jokes? They\'d crack each other up.', 'I only know 25 letters of the alphabet. I don\'t know y.', 'What do you call fake spaghetti? An impasta.'],
  pickupline: ['Are you a wild +4? Because you just changed my whole game.', 'Do you have a map? I keep getting lost in your eyes.', 'Are you Wi-Fi? Because I\'m feeling a connection.', 'You must be a UNO card, because you\'re a perfect match.'],
};

const pickTemplate = (name, lines, emoji) =>
  `import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = ${JSON.stringify(lines, null, 2)};

export const data = new SlashCommandBuilder()
  .setName('${name}')
  .setDescription('${`Random ${name}`.slice(0, 100)}');

export async function execute(interaction) {
  await interaction.reply(${emoji ? `'${emoji} ' + ` : ''}pick(LINES));
}
`;

const PICK_EMOJI = { fortune: '🥠', wisdom: '🧘', affirmation: '💫', motivate: '🔥', hype: '🎉', bored: '🎲', activity: '🏃', neverhaveiever: '🙊', paranoia: '😳', conspiracy: '👽', excuse: '🤥', prediction: '🔮', horoscope: '♈', spacefact: '🚀', catfact: '🐱', dogfact: '🐶', historyfact: '📜', pun: '😹', knockknock: '🚪', oneliner: '🎤', lifehack: '💡', starter: '💬', debate: '⚖️', hottake: '🌶️', unpopular: '🙃', vibecheck: '✨', complimentme: '💖', riddle: '🧩', advice: '🧠', dadjoke: '👴', pickupline: '😏' };
for (const [name, lines] of Object.entries(PICKS)) emit('gamification', name, pickTemplate(name, lines, PICK_EMOJI[name] || '🎲'));

// ---------- 2) TEXT TRANSFORM commands ----------
const TRANSFORMS = {
  uppercase: { d: 'UPPERCASE your text', b: `return t.toUpperCase();` },
  lowercase: { d: 'lowercase your text', b: `return t.toLowerCase();` },
  titlecase: { d: 'Title Case your text', b: `return t.replace(/\\\\w\\\\S*/g, w => w[0].toUpperCase()+w.slice(1).toLowerCase());` },
  leet: { d: 'Convert text to l33t speak', b: `return t.replace(/[aeiostAEIOST]/g, c => ({a:'4',e:'3',i:'1',o:'0',s:'5',t:'7',A:'4',E:'3',I:'1',O:'0',S:'5',T:'7'}[c]));` },
  vaporwave: { d: 'ｆｕｌｌ-ｗｉｄｔｈ vaporwave text', b: `return [...t].map(c=>{const o=c.charCodeAt(0);return o>=33&&o<=126?String.fromCharCode(o+65248):c===' '?'　':c;}).join('');` },
  upsidedown: { d: 'Flip your text ¡uʍop ǝpısdn', b: `const m={a:'ɐ',b:'q',c:'ɔ',d:'p',e:'ǝ',f:'ɟ',g:'ƃ',h:'ɥ',i:'ı',j:'ɾ',k:'ʞ',l:'l',m:'ɯ',n:'u',o:'o',p:'d',q:'b',r:'ɹ',s:'s',t:'ʇ',u:'n',v:'ʌ',w:'ʍ',x:'x',y:'ʎ',z:'z'};return [...t.toLowerCase()].reverse().map(c=>m[c]||c).join('');` },
  spaceout: { d: 'S p a c e   o u t   text', b: `return [...t].join(' ');` },
  binencode: { d: 'Encode text to binary', b: `return [...t].map(c=>c.charCodeAt(0).toString(2).padStart(8,'0')).join(' ');` },
  bindecode: { d: 'Decode binary to text', b: `return t.trim().split(/\\\\s+/).map(b=>String.fromCharCode(parseInt(b,2))).join('');` },
  morseencode: { d: 'Encode text to Morse code', b: `const M={a:'.-',b:'-...',c:'-.-.',d:'-..',e:'.',f:'..-.',g:'--.',h:'....',i:'..',j:'.---',k:'-.-',l:'.-..',m:'--',n:'-.',o:'---',p:'.--.',q:'--.-',r:'.-.',s:'...',t:'-',u:'..-',v:'...-',w:'.--',x:'-..-',y:'-.--',z:'--..','0':'-----','1':'.----','2':'..---','3':'...--','4':'....-','5':'.....','6':'-....','7':'--...','8':'---..','9':'----.'};return [...t.toLowerCase()].map(c=>c===' '?'/':(M[c]||'')).join(' ').trim();` },
  rot13: { d: 'ROT13 cipher', b: `return t.replace(/[a-zA-Z]/g,c=>String.fromCharCode((c<='Z'?90:122)>=(c.charCodeAt(0)+13)?c.charCodeAt(0)+13:c.charCodeAt(0)-13));` },
  hexencode: { d: 'Encode text to hex', b: `return Buffer.from(t,'utf8').toString('hex');` },
  hexdecode: { d: 'Decode hex to text', b: `return Buffer.from(t.replace(/\\\\s/g,''),'hex').toString('utf8');` },
  urlencode: { d: 'URL-encode text', b: `return encodeURIComponent(t);` },
  urldecode: { d: 'URL-decode text', b: `return decodeURIComponent(t);` },
  slugify: { d: 'Make a url-slug from text', b: `return t.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');` },
  wordcount: { d: 'Count words in text', b: `const w=t.trim()?t.trim().split(/\\\\s+/).length:0;return 'Words: '+w+' · Characters: '+t.length;` },
  snakecase: { d: 'snake_case your text', b: `return t.trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');` },
  kebabcase: { d: 'kebab-case your text', b: `return t.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');` },
  camelcase: { d: 'camelCase your text', b: `return t.trim().toLowerCase().replace(/[^a-z0-9]+(.)/g,(_,c)=>c.toUpperCase());` },
  repeat: { d: 'Repeat text a few times', b: `return (t+' ').repeat(5).trim();` },
  shuffletext: { d: 'Shuffle the letters of text', b: `const a=[...t];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a.join('');` },
  redact: { d: 'Black-bar redact text', b: `return t.replace(/\\\\S/g,'█');` },
  stutter: { d: 'A-add a stutter to text', b: `return t.split(' ').map(w=>w?w[0]+'-'+w:w).join(' ');` },
  pirate: { d: 'Talk like a pirate', b: `return t.replace(/\\\\byou\\\\b/gi,'ye').replace(/\\\\bmy\\\\b/gi,'me').replace(/\\\\bis\\\\b/gi,'be').replace(/\\\\bhello\\\\b/gi,'ahoy')+' arr! 🏴‍☠️';` },
  censor: { d: 'Censor all but first letter of each word', b: `return t.split(' ').map(w=>w?w[0]+'*'.repeat(Math.max(0,w.length-1)):w).join(' ');` },
  emojispam: { d: 'Sprinkle emoji between words', b: `const e=['✨','🔥','💯','🎉','😎','🌟'];return t.split(' ').join(' '+e[Math.floor(Math.random()*e.length)]+' ');` },
  wavetext: { d: 'wAvE cAsE your text', b: `return [...t].map((c,i)=>i%2?c.toUpperCase():c.toLowerCase()).join('');` },
};
const transformTemplate = (name, d, body) =>
  `import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('${name}')
  .setDescription(${JSON.stringify(d.slice(0, 100))})
  .addStringOption((o) => o.setName('text').setDescription('Text to transform').setRequired(true));

export async function execute(interaction) {
  const t = interaction.options.getString('text');
  let out;
  try { out = (function (t) { ${body} })(t); } catch { out = '⚠️ Could not transform that.'; }
  await interaction.reply({ content: String(out ?? '').slice(0, 1990) || '\\u200b' });
}
`;
for (const [name, { d, b }] of Object.entries(TRANSFORMS)) emit('utility', name, transformTemplate(name, d, b));

// ---------- 3) RANDOM GENERATOR commands ----------
const dice = [2, 3, 4, 6, 8, 10, 12, 20, 100];
for (const sides of dice) {
  const name = 'd' + sides;
  emit('utility', name,
`import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';

export const data = new SlashCommandBuilder().setName('${name}').setDescription('Roll a ${sides}-sided die');

export async function execute(interaction) {
  await interaction.reply('🎲 You rolled a **' + rint(1, ${sides}) + '** (d${sides}).');
}
`);
}

const GENS = {
  flip: { d: 'Flip a coin', c: `return Math.random()<0.5?'🪙 Heads!':'🪙 Tails!';` },
  yesno: { d: 'Ask the bot yes or no', c: `return pick(['✅ Yes.','❌ No.','🤔 Maybe.','💯 Definitely.','🙅 Absolutely not.']);` },
  percent: { d: 'Get a random percentage', c: `return '📊 ' + rint(0,100) + '%';` },
  hexcolor: { d: 'Generate a random hex color', c: `return '🎨 #' + Math.floor(Math.random()*0xffffff).toString(16).padStart(6,'0').toUpperCase();` },
  randomemoji: { d: 'Get a random emoji', c: `return pick(['😀','🦄','🍕','🚀','🐙','🎲','🔥','🌈','👾','🍩','🐸','⚡','🎸','🦖','🍔','🛸']);` },
  randomanimal: { d: 'Get a random animal', c: `return '🐾 ' + pick(['Red Panda','Axolotl','Capybara','Narwhal','Pangolin','Quokka','Otter','Fennec Fox','Sloth','Platypus']);` },
  randomname: { d: 'Generate a random name', c: `return '🪪 ' + pick(['Alex','Jordan','Riley','Sam','Taylor','Casey','Morgan','Jamie']) + ' ' + pick(['Stone','Vale','Reed','Frost','Quinn','Hart','Lane','Cruz']);` },
  randomcountry: { d: 'Pick a random country', c: `return '🌍 ' + pick(['Japan','Brazil','Norway','Kenya','Canada','Italy','Thailand','Morocco','Peru','New Zealand']);` },
  randomword: { d: 'Get a random word', c: `return '🔤 ' + pick(['serendipity','nebula','quasar','lumen','zephyr','cascade','ember','pixel','vortex','aurora']);` },
  lotto: { d: 'Generate lucky lotto numbers', c: `const s=new Set();while(s.size<6)s.add(rint(1,49));return '🎟️ ' + [...s].sort((a,b)=>a-b).join(' - ');` },
  magicnumber: { d: 'A random magic number 1-1000', c: `return '🔢 ' + rint(1,1000);` },
  pickcard: { d: 'Draw a random UNO card', c: `return '🃏 ' + pick(['Red','Green','Blue','Yellow']) + ' ' + pick(['0','1','2','3','4','5','6','7','8','9','Skip','Reverse','+2']);` },
  spinner: { d: 'Spin the wheel of fate', c: `return '🎡 The wheel landed on: **' + pick(['Win','Lose','Spin again','Jackpot','Nothing','Bonus']) + '**';` },
  ball: { d: 'Bounce the chaos ball', c: `return pick(['🟢 GO for it!','🔴 Stop right there.','🟡 Proceed with caution.','🔵 Sleep on it.']);` },
  rpsls: { d: 'Rock Paper Scissors Lizard Spock vs bot', c: `return '🖖 The bot chose **' + pick(['Rock','Paper','Scissors','Lizard','Spock']) + '**!';` },
  scramble: { d: 'Get a scrambled word to unscramble', c: `const w=pick(['planet','dragon','wizard','rocket','garden','castle']);const a=[...w];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return '🔀 Unscramble: **'+a.join('')+'** ||('+w+')||';` },
};
const genTemplate = (name, d, code) =>
  `import { SlashCommandBuilder } from 'discord.js';
import { rint, pick } from '../../util.js';

export const data = new SlashCommandBuilder().setName('${name}').setDescription(${JSON.stringify(d.slice(0, 100))});

export async function execute(interaction) {
  const out = (function () { ${code} })();
  await interaction.reply(String(out).slice(0, 1990));
}
`;
for (const [name, { d, c }] of Object.entries(GENS)) emit('utility', name, genTemplate(name, d, c));

// uuid (uses crypto)
emit('utility', 'uuid',
`import { SlashCommandBuilder } from 'discord.js';
import { randomUUID } from 'node:crypto';

export const data = new SlashCommandBuilder().setName('uuid').setDescription('Generate a random UUID v4');

export async function execute(interaction) {
  await interaction.reply('🆔 \\\`' + randomUUID() + '\\\`');
}
`);

// ---------- 4) ECONOMY earn/gamble commands ----------
const EARN = {
  fish: { e: '🎣', cd: 20, min: 5_000, max: 90_000, fail: 0.2, verbs: ['reeled in a big catch', 'hooked a rare fish', 'netted a haul'] },
  hunt: { e: '🏹', cd: 20, min: 8_000, max: 110_000, fail: 0.25, verbs: ['bagged some game', 'tracked a rare beast', 'had a good hunt'] },
  dig: { e: '⛏️', cd: 20, min: 6_000, max: 120_000, fail: 0.25, verbs: ['dug up buried coins', 'unearthed a relic', 'found a stash'] },
  mine: { e: '⚒️', cd: 30, min: 10_000, max: 160_000, fail: 0.3, verbs: ['mined precious ore', 'struck a gem vein', 'hauled out gold'] },
  chop: { e: '🪓', cd: 15, min: 4_000, max: 70_000, fail: 0.15, verbs: ['chopped & sold lumber', 'cleared a forest plot', 'split a big log'] },
  forage: { e: '🍄', cd: 15, min: 3_000, max: 60_000, fail: 0.15, verbs: ['foraged rare herbs', 'found wild truffles', 'gathered berries'] },
  adventure: { e: '🗺️', cd: 45, min: 50_000, max: 400_000, fail: 0.4, verbs: ['cleared a dungeon', 'looted a ruin', 'survived a quest'] },
  explore: { e: '🧭', cd: 45, min: 40_000, max: 350_000, fail: 0.4, verbs: ['charted new lands', 'found hidden treasure', 'mapped a cave'] },
  farm: { e: '🌾', cd: 30, min: 12_000, max: 140_000, fail: 0.1, verbs: ['sold a big harvest', 'shipped fresh crops', 'had a bumper yield'] },
  smuggle: { e: '📦', cd: 60, min: 80_000, max: 600_000, fail: 0.5, verbs: ['ran contraband', 'moved hot cargo', 'dodged the patrol'] },
  bountyhunt: { e: '🎯', cd: 60, min: 90_000, max: 700_000, fail: 0.5, verbs: ['collected a bounty', 'caught a fugitive', 'claimed a reward'] },
  invest: { e: '📈', cd: 60, min: 0, max: 0, fail: 0.45, verbs: ['rode a bull market', 'timed the dip', 'cashed out gains'], pct: true },
};
const earnTemplate = (name, o) => {
  const pctBody = o.pct
    ? `  const stake = Math.min(bal.wallet, 200000);
  if (stake < 1000) return interaction.reply(eph('❌ You need at least some tokens in your wallet to ${name}.'));
  if (Math.random() < ${o.fail}) { addWallet(id, -stake, '${name}'); return interaction.reply('${o.e} The market crashed — you lost ' + TOKEN + ' ' + stake.toLocaleString() + '.'); }
  const gain = Math.round(stake * (0.2 + Math.random()));
  addWallet(id, gain, '${name}');
  return interaction.reply('${o.e} You ' + pick(VERBS) + ' and gained ' + TOKEN + ' ' + gain.toLocaleString() + '!');`
    : `  if (Math.random() < ${o.fail}) { const fee = rint(1000, 20000); addWallet(id, -fee, '${name}'); return interaction.reply('${o.e} No luck this time — it cost you ' + TOKEN + ' ' + fee.toLocaleString() + '.'); }
  const amt = rint(${o.min}, ${o.max});
  addWallet(id, amt, '${name}');
  return interaction.reply('${o.e} You ' + pick(VERBS) + ' and earned ' + TOKEN + ' ' + amt.toLocaleString() + '!');`;
  return `import { SlashCommandBuilder } from 'discord.js';
import { addWallet, balance, checkCooldown, setCooldown } from '../../economy/store.js';
import { eph, fmtDuration, rint, pick } from '../../util.js';
import { TOKEN } from '../../config.js';

const CD = ${o.cd} * 60 * 1000;
const VERBS = ${JSON.stringify(o.verbs)};

export const data = new SlashCommandBuilder().setName('${name}').setDescription('${o.e} Earn UNO Tokens by ${name}-ing');

export async function execute(interaction) {
  const id = interaction.user.id;
  const left = checkCooldown(id, '${name}', CD);
  if (left) return interaction.reply(eph('⏳ Not yet — try again in ' + fmtDuration(left) + '.'));
  setCooldown(id, '${name}');
  const bal = balance(id);
${pctBody}
}
`;
};
for (const [name, o] of Object.entries(EARN)) emit('economy', name, earnTemplate(name, o));

// instant gamble games
emit('economy', 'highlow',
`import { SlashCommandBuilder } from 'discord.js';
import { balance, addWallet } from '../../economy/store.js';
import { eph, rint } from '../../util.js';
import { TOKEN } from '../../config.js';

export const data = new SlashCommandBuilder()
  .setName('highlow')
  .setDescription('Guess if the next number (1-100) is higher or lower than 50')
  .addStringOption((o) => o.setName('guess').setDescription('high or low').setRequired(true).addChoices({ name: 'high', value: 'high' }, { name: 'low', value: 'low' }))
  .addIntegerOption((o) => o.setName('amount').setDescription('Bet').setRequired(true).setMinValue(1));

export async function execute(interaction) {
  const g = interaction.options.getString('guess');
  const bet = interaction.options.getInteger('amount');
  if (balance(interaction.user.id).wallet < bet) return interaction.reply(eph('❌ Not enough tokens.'));
  const n = rint(1, 100);
  const win = (g === 'high' && n > 50) || (g === 'low' && n < 50);
  addWallet(interaction.user.id, win ? bet : -bet, 'highlow');
  await interaction.reply('🎚️ The number was **' + n + '**. You ' + (win ? 'WON ' : 'lost ') + TOKEN + ' ' + bet.toLocaleString() + (n === 50 ? ' (50 is a push-ish, you lost the edge)' : '') + '.');
}
`);

emit('economy', 'scratch',
`import { SlashCommandBuilder } from 'discord.js';
import { balance, addWallet } from '../../economy/store.js';
import { eph, pick } from '../../util.js';
import { TOKEN } from '../../config.js';

const COST = 15000;
const SYMS = ['🍒','💎','⭐','🔔','🍀'];

export const data = new SlashCommandBuilder().setName('scratch').setDescription('Buy a 15k scratch card — match 3 to win big');

export async function execute(interaction) {
  if (balance(interaction.user.id).wallet < COST) return interaction.reply(eph('❌ A scratch card costs ' + TOKEN + ' ' + COST.toLocaleString() + '.'));
  addWallet(interaction.user.id, -COST, 'scratch');
  const cells = [pick(SYMS), pick(SYMS), pick(SYMS)];
  const three = cells[0] === cells[1] && cells[1] === cells[2];
  const two = new Set(cells).size === 2;
  const prize = three ? 300000 : two ? 25000 : 0;
  if (prize) addWallet(interaction.user.id, prize, 'scratch');
  await interaction.reply('🎫 ' + cells.join(' ') + ' — ' + (prize ? 'You won ' + TOKEN + ' ' + prize.toLocaleString() + '!' : 'No match, better luck next time!'));
}
`);

emit('economy', 'wheel',
`import { SlashCommandBuilder } from 'discord.js';
import { balance, addWallet } from '../../economy/store.js';
import { eph, pick } from '../../util.js';
import { TOKEN } from '../../config.js';

const SEGMENTS = [0, 0.5, 1, 1.5, 2, 0, 3, 5];

export const data = new SlashCommandBuilder()
  .setName('wheel')
  .setDescription('Spin the multiplier wheel with a bet')
  .addIntegerOption((o) => o.setName('amount').setDescription('Bet').setRequired(true).setMinValue(1));

export async function execute(interaction) {
  const bet = interaction.options.getInteger('amount');
  if (balance(interaction.user.id).wallet < bet) return interaction.reply(eph('❌ Not enough tokens.'));
  const mult = pick(SEGMENTS);
  const delta = Math.round(bet * mult) - bet;
  addWallet(interaction.user.id, delta, 'wheel');
  await interaction.reply('🎡 The wheel hit **x' + mult + '**! Net ' + (delta >= 0 ? '+' : '') + TOKEN + ' ' + delta.toLocaleString() + '.');
}
`);

console.log('Generated', written, 'new command files.');
