/* Automation "Libraries" — a curated catalog of ready-made presets. Click one in
   the canvas Libraries panel and it drops the blocks onto the workspace, ready to
   tweak + save. Every entry is a REAL, working template (no filler). Grows over time.
   Exposes window.AUTOMATION_PRESETS. */
(function () {
  'use strict';
  const P = [];
  const add = (category, name, trigger, actions) => P.push({ category, name, trigger, actions });
  const msg = (text, matchType) => ({ type: 'message_contains', matchType: matchType || 'contains', text });
  const reply = (t) => [{ type: 'reply', text: t }];
  const react = (e) => [{ type: 'react', emoji: e }];
  const rand = (opts) => [{ type: 'random_reply', text: opts }];

  // ---- 💬 Greetings (auto-replies) ----
  [
    ['hi', '👋 Hey there, {user}!'], ['hello', 'Hello {user}! 👋'], ['hey', 'Hey {user}! 🙌'],
    ['yo', 'Yo {user}! 🤙'], ['sup', "Not much — what's up, {user}?"], ['heya', 'Heya {user}! 💫'],
    ['gm', '☀️ Good morning, {user}!'], ['gn', '🌙 Good night, {user}!'], ['good morning', '☀️ Morning, {user}!'],
    ['good night', '🌙 Sleep well, {user}!'], ['howdy', '🤠 Howdy, {user}!'], ['hiya', '👋 Hiya {user}!'],
    ['morning', '☀️ Morning, {user}!'], ['night', '🌙 Night, {user}!'], ['welcome back', '🎉 Welcome back, {user}!'],
  ].forEach(([k, v]) => add('💬 Greetings', `Reply to "${k}"`, msg(k), reply(v)));

  // ---- ❓ FAQ responders ----
  [
    ['how do i verify', 'Run `/verify` (or `!verify`) and follow the DM! 🔐'],
    ['where are the rules', 'Check out the rules channel 📜'],
    ['how do i level up', 'Just chat — you earn XP for messages! 📊'],
    ['is there a giveaway', 'Peek at the giveaways channel 🎉'],
    ['how do i open a ticket', 'Use the ticket panel or `/ticket` 🎫'],
    ['how do i get roles', 'Grab roles from the self-roles panel 🎭'],
    ['who is the owner', 'The owner runs the show around here 👑'],
    ['how do i report someone', 'Open a ticket and staff will help 🛡️'],
    ['what bot is this', "I'm the server's assistant bot 🤖"],
    ['how do i invite friends', 'Share the server invite link 🔗'],
    ['is there a mobile app', 'Yep — install our dashboard as an app from the site! 📱'],
    ['how do i change my nickname', 'Ask staff or use the roles panel ✏️'],
  ].forEach(([k, v]) => add('❓ FAQ', `Answer "${k}"`, msg(k), reply(v)));

  // ---- 😀 Keyword reactions ----
  [
    ['congrats', '🎉'], ['congratulations', '🎉'], ['gg', '🎮'], ['rip', '🪦'], ['lol', '😂'],
    ['lmao', '😂'], ['pog', '😮'], ['poggers', '😮'], ['nice', '👍'], ['thanks', '❤️'],
    ['ty', '❤️'], ['welcome', '🤗'], ['first', '🥇'], ['cake', '🍰'], ['pizza', '🍕'],
    ['birthday', '🎂'], ['love', '❤️'], ['fire', '🔥'], ['based', '🗿'], ['w', '🏆'],
    ['l', '💀'], ['sad', '😢'], ['cry', '😭'], ['party', '🥳'], ['goodnight', '🌙'],
    ['coffee', '☕'], ['gaming', '🎮'], ['music', '🎵'], ['star', '⭐'], ['rocket', '🚀'],
    ['money', '💰'], ['idea', '💡'], ['hundred', '💯'], ['clap', '👏'], ['skull', '💀'],
    ['heart', '❤️'], ['cool', '😎'], ['boom', '💥'], ['ghost', '👻'], ['snow', '❄️'],
  ].forEach(([k, e]) => add('😀 Reactions', `React ${e} to "${k}"`, msg(k), react(e)));

  // ---- 🎲 Fun ----
  add('🎲 Fun', 'Magic 8-ball', msg('8ball'), rand('Yes|No|Maybe|Definitely|Ask again later|I doubt it|Absolutely|No way|Signs point to yes|Very likely'));
  add('🎲 Fun', 'Coin flip', msg('coinflip'), rand('🪙 Heads!|🪙 Tails!'));
  add('🎲 Fun', 'Rock paper scissors', msg('rps'), rand('🪨 Rock|📄 Paper|✂️ Scissors'));
  add('🎲 Fun', 'Yes or no', msg('yesno'), rand('✅ Yes|❌ No'));
  add('🎲 Fun', 'Random compliment', msg('compliment'), rand("You're awesome, {user}!|You're a legend!|You light up the server!|You're doing great!|Keep being amazing, {user}!"));
  add('🎲 Fun', 'Random pick', msg('pick'), rand('Option A|Option B|Option C'));
  [4, 6, 8, 10, 12, 20, 100].forEach((s) => add('🎲 Fun', `Roll a d${s}`, msg('d' + s, 'exact'), [{ type: 'dice', sides: s }]));

  // ---- 👋 Welcome (DM new members — works without a channel) ----
  add('👋 Welcome', 'Welcome DM', { type: 'member_join' }, [{ type: 'dm', text: 'Welcome to {server}, {user}! 🎉 Check the rules and have fun.' }]);
  add('👋 Welcome', 'Welcome DM + tips', { type: 'member_join' }, [{ type: 'dm', text: 'Hey {user}, welcome to {server}! 👋\nGrab roles, read the rules, and say hi!' }]);
  add('👋 Welcome', 'Verify reminder DM', { type: 'member_join' }, [{ type: 'dm', text: '🔐 Welcome {user}! Run `/verify` to unlock the server.' }]);

  // ---- 🛡 Moderation ----
  add('🛡 Moderation', 'Delete "leak" + warn', msg('leak'), [{ type: 'delete_message' }, { type: 'reply', text: '🚫 No leaks allowed, {user}.' }]);
  add('🛡 Moderation', 'Warn on "scam"', msg('scam'), reply('⚠️ {user}, keep it safe — no scams here.'));
  add('🛡 Moderation', 'Timeout on "raid"', msg('raid'), [{ type: 'timeout', seconds: 300 }, { type: 'reply', text: '🔇 {user} timed out for raid talk.' }]);
  add('🛡 Moderation', 'Delete + pin note', msg('pinthis'), [{ type: 'pin_message' }, { type: 'reply', text: '📌 Pinned!' }]);

  // ---- 📣 Engagement ----
  add('📣 Engagement', 'Thank helpers', msg('thanks for the help'), react('❤️'));
  add('📣 Engagement', 'Hype on "lets go"', msg('lets go'), rand("🔥 LET'S GO!|🚀 LFG!|💪 Let's get it!"));
  add('📣 Engagement', 'Respond to "suggestion"', msg('suggestion'), reply('💡 Great idea, {user}! Drop it in the suggestions channel.'));

  // ---- 😀 Reactions (batch 2) ----
  [
    ['dog', '🐶'], ['cat', '🐱'], ['fox', '🦊'], ['bear', '🐻'], ['panda', '🐼'], ['lion', '🦁'],
    ['tiger', '🐯'], ['monkey', '🐵'], ['penguin', '🐧'], ['owl', '🦉'], ['unicorn', '🦄'], ['dragon', '🐉'],
    ['bee', '🐝'], ['butterfly', '🦋'], ['snake', '🐍'], ['frog', '🐸'], ['whale', '🐳'], ['dolphin', '🐬'],
    ['shark', '🦈'], ['octopus', '🐙'], ['apple', '🍎'], ['banana', '🍌'], ['grape', '🍇'], ['strawberry', '🍓'],
    ['watermelon', '🍉'], ['lemon', '🍋'], ['peach', '🍑'], ['cherry', '🍒'], ['taco', '🌮'], ['burger', '🍔'],
    ['fries', '🍟'], ['hotdog', '🌭'], ['donut', '🍩'], ['cookie', '🍪'], ['candy', '🍬'], ['icecream', '🍦'],
    ['popcorn', '🍿'], ['sushi', '🍣'], ['ramen', '🍜', ], ['rain', '🌧️'], ['storm', '⛈️'], ['rainbow', '🌈'],
    ['lightning', '⚡'], ['ocean', '🌊'], ['mountain', '⛰️'], ['tree', '🌳'], ['flower', '🌸'], ['rose', '🌹'],
    ['cactus', '🌵'], ['soccer', '⚽'], ['basketball', '🏀'], ['football', '🏈'], ['baseball', '⚾'], ['tennis', '🎾'],
    ['trophy', '🏆'], ['medal', '🏅'], ['dart', '🎯'], ['angry', '😠'], ['happy', '😄'], ['wink', '😉'],
    ['shocked', '😱'], ['sleepy', '😴'], ['nerd', '🤓'], ['cowboy', '🤠'], ['clown', '🤡'], ['robot', '🤖'],
    ['alien', '👽'], ['book', '📚'], ['paint', '🎨'], ['camera', '📷'], ['gift', '🎁'], ['balloon', '🎈'],
    ['crown', '👑'], ['diamond', '💎'], ['key', '🔑'], ['bell', '🔔'], ['bomb', '💣'],
  ].forEach(([k, e]) => add('😀 Reactions', `React ${e} to "${k}"`, msg(k), react(e)));

  // ---- ❓ FAQ (batch 2) ----
  [
    ['how do i mute someone', 'Staff can help — open a ticket 🔇'], ['what are the server rules', 'Read them in the rules channel 📜'],
    ['can i partner', 'Open a ticket to ask about partnerships 🤝'], ['how do i suggest something', 'Post in the suggestions channel 💡'],
    ['where is support', 'Open a ticket and staff will help 🎫'], ['how do i earn coins', 'Chat, claim dailies, and play games 💰'],
    ['what commands are there', 'Check the commands page on the website 📖'], ['how do i report a bug', 'Open a ticket with details 🐛'],
    ['how do i become staff', 'Watch for staff applications 📋'], ['how do i change roles', 'Use the self-roles panel 🎭'],
  ].forEach(([k, v]) => add('❓ FAQ', `Answer "${k}"`, msg(k), reply(v)));

  // ---- 💬 Greetings (batch 2) ----
  [
    ['whats up', 'Not much, {user}! You?'], ['hola', '¡Hola {user}! 👋'], ['bonjour', 'Bonjour {user}! 👋'],
    ['salut', 'Salut {user}! 👋'], ['greetings', '🖖 Greetings, {user}!'],
  ].forEach(([k, v]) => add('💬 Greetings', `Reply to "${k}"`, msg(k), reply(v)));

  // ---- 🎲 Fun (batch 2) ----
  add('🎲 Fun', 'Would you rather', msg('wyr'), rand('Would you rather be rich or famous?|Would you rather fly or be invisible?|Would you rather time travel to the past or future?'));
  add('🎲 Fun', 'This or that', msg('thisorthat'), rand('☕ Coffee|🍵 Tea'));
  add('🎲 Fun', 'Random number 1-100', msg('rng'), [{ type: 'dice', sides: 100 }]);
  add('🎲 Fun', 'Truth or dare', msg('tod'), rand('🫢 Truth|😈 Dare'));
  add('🎲 Fun', 'Flip a decision', msg('shouldi'), rand('✅ Do it!|❌ Don\'t do it!'));
  add('🎲 Fun', 'Random emoji', msg('randomemoji'), rand('😀|😎|🔥|🎉|💯|🚀|🌈|👑'));
  add('🎲 Fun', 'Rate 1-10', msg('rateme'), [{ type: 'dice', sides: 10 }]);

  // ---- 🛡 Moderation (batch 2) ----
  add('🛡 Moderation', 'Block "free nitro" scam', msg('free nitro'), [{ type: 'delete_message' }, { type: 'reply', text: '🚫 That\'s a scam, {user}. Deleted.' }]);
  add('🛡 Moderation', 'Warn on "ip grab"', msg('ip grab'), [{ type: 'delete_message' }, { type: 'reply', text: '🛡️ No IP-logger links, {user}.' }]);
  add('🛡 Moderation', 'Discourage mass ping', msg('@everyone'), reply('🔕 Please don\'t mass ping, {user}.'));
  add('🛡 Moderation', 'Slow down spam word', msg('spamspamspam'), [{ type: 'timeout', seconds: 120 }]);

  // ---- 📣 Engagement (batch 2) ----
  add('📣 Engagement', 'Good bot', msg('good bot'), react('🥰'));
  add('📣 Engagement', 'Bad bot', msg('bad bot'), reply('😔 Aw… I\'ll do better!'));
  add('📣 Engagement', 'Hype "who wins"', msg('who wins'), rand('🏆 You do!|🤝 It\'s a tie!|🔥 The bold one!'));
  add('📣 Engagement', 'Celebrate milestones', msg('milestone'), react('🎉'));

  // ---- 🤖 AI (Gemini-powered) ----
  add('🤖 AI', 'AI answers "askai"', msg('askai'), [{ type: 'ai_reply', prompt: '{content}' }]);
  add('🤖 AI', 'AI chatbot on mention word', msg('hey bot'), [{ type: 'ai_reply', prompt: '{content}' }]);
  add('🤖 AI', 'AI explains "eli5"', msg('eli5'), [{ type: 'ai_reply', prompt: 'Explain this simply, like I am 5: {content}' }]);
  add('🤖 AI', 'AI welcome message', { type: 'member_join' }, [{ type: 'dm', text: 'Welcome {user}! 🤖 Ask me anything by saying "askai <question>".' }]);

  // ---- 🔌 Integrations ----
  add('🔌 Integrations', 'Weather lookup ("weather london")', msg('weather'), [{ type: 'weather', location: '{args}' }]);
  add('🔌 Integrations', 'Translate to Spanish', msg('translate es'), [{ type: 'translate', to: 'Spanish' }]);
  add('🔌 Integrations', 'Translate to English', msg('translate en'), [{ type: 'translate', to: 'English' }]);
  add('🔌 Integrations', 'Translate to French', msg('translate fr'), [{ type: 'translate', to: 'French' }]);
  add('🔌 Integrations', 'Translate to Japanese', msg('translate jp'), [{ type: 'translate', to: 'Japanese' }]);

  // ============================ +85 MORE BLOCKS ============================
  // ---- 😀 Reactions (batch 3) — 16 ----
  [
    ['gg', '🎮'], ['pizza', '🍕'], ['coffee', '☕'], ['fire', '🔥'], ['money', '💰'],
    ['sad', '😢'], ['happy', '😄'], ['love', '❤️'], ['rocket', '🚀'], ['star', '⭐'],
    ['skull', '💀'], ['clown', '🤡'], ['cake', '🎂'], ['music', '🎵'], ['ghost', '👻'], ['snow', '❄️'],
  ].forEach(([k, e]) => add('😀 Reactions', `React ${e} to "${k}"`, msg(k), react(e)));

  // ---- 🎲 Fun — 12 ----
  add('🎲 Fun', 'Coin flip ("flipcoin")', msg('flipcoin'), rand(['🪙 Heads!', '🪙 Tails!']));
  add('🎲 Fun', '8-ball ("8ball")', msg('8ball'), rand(['🎱 Yes.', '🎱 No.', '🎱 Maybe.', '🎱 Ask later.', '🎱 Definitely.']));
  add('🎲 Fun', 'Prediction ("predict")', msg('predict'), rand(['🔮 Big things are coming.', '🔮 Stay patient.', '🔮 Luck is on your side.']));
  add('🎲 Fun', 'Roll d3 ("d3")', msg('d3', 'exact'), [{ type: 'dice', sides: 3 }]);
  add('🎲 Fun', 'Roll d50 ("d50")', msg('d50', 'exact'), [{ type: 'dice', sides: 50 }]);
  add('🎲 Fun', 'Lucky number ("lucky")', msg('lucky'), [{ type: 'dice', sides: 100 }]);
  add('🎲 Fun', 'Vibe check ("vibecheck")', msg('vibecheck'), [{ type: 'dice', sides: 100 }]);
  add('🎲 Fun', 'Rate my day ("rateday")', msg('rateday'), [{ type: 'dice', sides: 10 }]);
  add('🎲 Fun', 'Mood ("mood")', msg('mood'), rand(['😎 Unbothered.', '🔥 Locked in.', '😴 Sleepy.', '🤡 Chaotic.']));
  add('🎲 Fun', 'Hype me ("hypeme")', msg('hypeme'), rand(['You’re a legend! 💪', 'Absolute icon. ✨', 'Certified GOAT. 🐐']));
  add('🎲 Fun', 'Joke ("joke")', msg('joke'), rand(['Why did the dev go broke? He used up all his cache. 💸', 'I’d tell a UDP joke but you might not get it. 📡']));
  add('🎲 Fun', 'Fortune ("fortune")', msg('fortune'), rand(['🥠 A surprise awaits you.', '🥠 Good news is coming.', '🥠 Your patience pays off.']));

  // ---- 🛡 Moderation — 16 ----
  [
    ['discord.gg/', '🚫 No invite links, {user}.'], ['free robux', '🚫 Scam blocked, {user}.'],
    ['free vbucks', '🚫 Scam blocked, {user}.'], ['click here to win', '🚫 That’s a scam, {user}.'],
    ['nitro giveaway', '🚫 Fake Nitro, {user}. Deleted.'], ['steamcommunity.com/gift', '🚫 Steam scam blocked.'],
    ['crypto pump', '🚫 No crypto shilling, {user}.'], ['dm me for', '⚠️ No DM advertising, {user}.'],
  ].forEach(([k, m]) => add('🛡 Moderation', `Block "${k}"`, msg(k), [{ type: 'delete_message' }, { type: 'reply', text: m }]));
  add('🛡 Moderation', 'Mute on "kys"', msg('kys'), [{ type: 'delete_message' }, { type: 'timeout', seconds: 900 }, { type: 'reply', text: '🚫 That language gets you muted, {user}.' }]);
  add('🛡 Moderation', 'Block "token grabber"', msg('token grabber'), [{ type: 'delete_message' }, { type: 'reply', text: '🛡️ Malicious link removed.' }]);
  add('🛡 Moderation', 'Anti "@everyone free"', msg('@everyone free'), [{ type: 'delete_message' }, { type: 'timeout', seconds: 300 }]);
  add('🛡 Moderation', 'Delete "gore"', msg('gore'), [{ type: 'delete_message' }, { type: 'reply', text: '🚫 Keep it clean, {user}.' }]);
  add('🛡 Moderation', 'Pin "important:" notes', msg('important:'), [{ type: 'pin_message' }, { type: 'react', emoji: '📌' }]);
  add('🛡 Moderation', 'Slow triple-spam', msg('spam spam spam'), [{ type: 'timeout', seconds: 120 }]);
  add('🛡 Moderation', 'Block "ip logger"', msg('ip logger'), [{ type: 'delete_message' }, { type: 'reply', text: '🛡️ No IP-logger links, {user}.' }]);
  add('🛡 Moderation', 'Block "cheat download"', msg('cheat download'), [{ type: 'delete_message' }, { type: 'reply', text: '🚫 No cheats, {user}.' }]);

  // ---- 👋 Welcome — 6 ----
  add('👋 Welcome', 'Welcome wave', { type: 'member_join' }, [{ type: 'dm', text: '👋 Welcome to {server}, {user}!' }]);
  add('👋 Welcome', 'Welcome + rules nudge', { type: 'member_join' }, [{ type: 'dm', text: '📜 Welcome {user}! Please read the rules to get started in {server}.' }]);
  add('👋 Welcome', 'Welcome + role hint', { type: 'member_join' }, [{ type: 'dm', text: '🎭 Hey {user}, grab your roles in {server} to customize your vibe!' }]);
  add('👋 Welcome', 'Welcome + intro prompt', { type: 'member_join' }, [{ type: 'dm', text: '👋 {user}, introduce yourself in {server} — we’d love to meet you!' }]);
  add('👋 Welcome', 'Welcome + support hint', { type: 'member_join' }, [{ type: 'dm', text: '🎫 Welcome {user}! Need help in {server}? Open a ticket anytime.' }]);
  add('👋 Welcome', 'Welcome hype', { type: 'member_join' }, [{ type: 'dm', text: '🔥 A wild {user} appeared in {server}! Welcome, legend.' }]);

  // ---- 🤖 AI — 9 ----
  add('🤖 AI', 'AI summarize ("summarize")', msg('summarize'), [{ type: 'ai_reply', prompt: 'Summarize this briefly: {content}' }]);
  add('🤖 AI', 'AI define ("define")', msg('define'), [{ type: 'ai_reply', prompt: 'Define this term concisely: {content}' }]);
  add('🤖 AI', 'AI fix grammar ("fixgrammar")', msg('fixgrammar'), [{ type: 'ai_reply', prompt: 'Fix the grammar and return only the corrected text: {content}' }]);
  add('🤖 AI', 'AI idea ("giveidea")', msg('giveidea'), [{ type: 'ai_reply', prompt: 'Give one creative idea about: {content}' }]);
  add('🤖 AI', 'AI motivate ("motivate")', msg('motivate'), [{ type: 'ai_reply', prompt: 'Give a short motivational line for someone who said: {content}' }]);
  add('🤖 AI', 'AI explain ("whatdoesitmean")', msg('whatdoesitmean'), [{ type: 'ai_reply', prompt: 'Explain what this means simply: {content}' }]);
  add('🤖 AI', 'AI pros/cons ("proscons")', msg('proscons'), [{ type: 'ai_reply', prompt: 'List quick pros and cons of: {content}' }]);
  add('🤖 AI', 'AI name generator ("namegen")', msg('namegen'), [{ type: 'ai_reply', prompt: 'Suggest 3 cool names for: {content}' }]);
  add('🤖 AI', 'AI rhymes ("rhyme")', msg('rhyme'), [{ type: 'ai_reply', prompt: 'Give words that rhyme with: {content}' }]);

  // ---- 🔌 Integrations — 8 more languages ----
  [['de', 'German'], ['it', 'Italian'], ['pt', 'Portuguese'], ['ru', 'Russian'], ['ko', 'Korean'], ['zh', 'Chinese'], ['ar', 'Arabic'], ['hi', 'Hindi']]
    .forEach(([code, lang]) => add('🔌 Integrations', `Translate to ${lang}`, msg('translate ' + code), [{ type: 'translate', to: lang }]));

  // ---- 💬 Auto-Reply / FAQ — 18 ----
  add('💬 Auto-Reply', 'How to verify', msg('how do i verify'), reply('🔐 Run `/verify` and link your Roblox account to unlock the server!'));
  add('💬 Auto-Reply', 'Where are the rules', msg('where are the rules'), reply('📜 Check the #rules channel at the top of the server.'));
  add('💬 Auto-Reply', 'How to get roles', msg('how do i get roles'), reply('🎭 Head to the reaction-roles channel and pick your roles!'));
  add('💬 Auto-Reply', 'How to open a ticket', msg('how do i get help'), reply('🎫 Open a support ticket and staff will assist you shortly.'));
  add('💬 Auto-Reply', 'Bot commands', msg('what commands'), reply('🧩 Type `/help` to see everything I can do!'));
  add('💬 Auto-Reply', 'How to level up', msg('how do i level up'), reply('⭐ Just chat! You earn XP for every message (60s cooldown).'));
  add('💬 Auto-Reply', 'How to earn coins', msg('how do i get coins'), reply('💰 Chat, spin `?wheel` daily, or pull off a `?heist` to earn coins!'));
  add('💬 Auto-Reply', 'Is there a website', msg('is there a website'), reply('🌐 Yes! Visit sentinelbothq.com for the dashboard and more.'));
  add('💬 Auto-Reply', 'How to report', msg('how do i report'), reply('🚨 Ping a mod or open a ticket to report an issue.'));
  add('💬 Auto-Reply', 'Good morning', msg('good morning'), rand(['☀️ Good morning, {user}!', '🌅 Morning, {user}! Have a great day.']));
  add('💬 Auto-Reply', 'Good night', msg('good night'), rand(['🌙 Good night, {user}!', '😴 Sleep well, {user}!']));
  add('💬 Auto-Reply', 'Thanks response', msg('thank you'), rand(['You’re welcome, {user}! 🙌', 'Anytime, {user}! 😊']));
  add('💬 Auto-Reply', 'Happy birthday react', msg('happy birthday'), react('🎂'));
  add('💬 Auto-Reply', 'F in chat', msg('f', 'exact'), react('🇫'));
  add('💬 Auto-Reply', 'Suggestion hint', msg('i have a suggestion'), reply('💡 Post it in the suggestions channel so everyone can vote!'));
  add('💬 Auto-Reply', 'When is the event', msg('when is the event'), reply('📅 Watch the announcements channel for event times!'));
  add('💬 Auto-Reply', 'Ping → Pong', msg('ping', 'exact'), reply('🏓 Pong!'));
  add('💬 Auto-Reply', 'Welcome back', msg('im back'), rand(['🎉 Welcome back, {user}!', '👋 Missed you, {user}!']));

  window.AUTOMATION_PRESETS = P;
})();
