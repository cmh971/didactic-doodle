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

  window.AUTOMATION_PRESETS = P;
})();
