/* Embed Template Library — 120 ready-to-use announcement embeds.
   Loaded before app.js; exposes window.EMBED_TEMPLATES. Placeholders like
   {server} and {user} are left for the sender to fill in. */
window.EMBED_TEMPLATES = [
  // ---- Announcements (12) ----
  { name: 'General Announcement', category: 'Announcements', emoji: '📢', color: '#5865f2', title: '📢 Announcement', description: "Hey @everyone! We've got something important to share with the community. Read on below.", footer: 'Posted by the staff team' },
  { name: 'Big News', category: 'Announcements', emoji: '🗞️', color: '#e91e63', title: '🗞️ Big News!', description: "Something exciting is happening in **{server}** — stay tuned for the full details.", footer: '{server}' },
  { name: 'Important Notice', category: 'Announcements', emoji: '❗', color: '#e74c3c', title: '❗ Important Notice', description: 'Please read this carefully — it affects everyone in the server.', footer: 'Staff announcement' },
  { name: 'Weekly Recap', category: 'Announcements', emoji: '📅', color: '#3498db', title: '📅 Weekly Recap', description: "Here's everything that happened this week in **{server}**.", footer: 'See you next week!' },
  { name: 'New Feature', category: 'Announcements', emoji: '✨', color: '#2ecc71', title: '✨ New Feature Unlocked', description: "We just rolled out something new. Check it out and let us know what you think!", footer: 'Feedback welcome' },
  { name: 'Milestone Reached', category: 'Announcements', emoji: '🎯', color: '#ffd23f', title: '🎯 Milestone Reached!', description: "We hit a huge milestone together. Thank you for being part of **{server}**!", footer: 'Onward and upward' },
  { name: 'Server Boost Thanks', category: 'Announcements', emoji: '🚀', color: '#f47fff', title: '🚀 Thanks for the Boost!', description: 'A massive thank you to everyone boosting the server. You make this place better!', footer: 'Boosters rock' },
  { name: 'Read the Pins', category: 'Announcements', emoji: '📌', color: '#95a5a6', title: '📌 Check the Pins', description: 'We just pinned some important messages — take a moment to read them.', footer: 'Stay informed' },
  { name: 'Heads Up', category: 'Announcements', emoji: '🔔', color: '#f39c12', title: '🔔 Heads Up', description: 'Quick heads up on something coming your way soon.', footer: 'More details to follow' },
  { name: 'Community Vote', category: 'Announcements', emoji: '🗳️', color: '#9b59b6', title: '🗳️ Your Vote Matters', description: 'We want your input! Vote below and help shape the future of the server.', footer: 'Every vote counts' },
  { name: 'Thank You', category: 'Announcements', emoji: '💜', color: '#8e44ad', title: '💜 Thank You', description: 'From all of us on the team — thank you for being part of this community.', footer: 'With love, the staff' },
  { name: 'Coming Soon', category: 'Announcements', emoji: '⏳', color: '#34495e', title: '⏳ Coming Soon', description: "Something big is on its way. We can't say much yet — but keep your eyes open.", footer: 'Patience pays off' },

  // ---- Welcome (10) ----
  { name: 'Welcome Warm', category: 'Welcome', emoji: '👋', color: '#2ecc71', title: '👋 Welcome!', description: 'Welcome to **{server}**, {user}! Grab a role, say hi, and make yourself at home.', footer: 'Glad you\'re here' },
  { name: 'Welcome Rules First', category: 'Welcome', emoji: '📖', color: '#3498db', title: '📖 Welcome — Read the Rules', description: 'Hey {user}! Before you dive in, please check out our rules channel. Enjoy your stay!', footer: 'Rules keep it fun' },
  { name: 'Welcome Gaming', category: 'Welcome', emoji: '🎮', color: '#e91e63', title: '🎮 A New Challenger Approaches!', description: '{user} just joined **{server}**! Ready player one?', footer: 'Game on' },
  { name: 'Welcome VIP', category: 'Welcome', emoji: '⭐', color: '#ffd23f', title: '⭐ Welcome, Superstar', description: 'The community just got better — welcome, {user}!', footer: 'You belong here' },
  { name: 'Welcome Cozy', category: 'Welcome', emoji: '🍵', color: '#d35400', title: '🍵 Come On In', description: 'Pull up a chair, {user}. Welcome to our cozy corner of Discord.', footer: 'Make yourself comfy' },
  { name: 'Welcome Space', category: 'Welcome', emoji: '🚀', color: '#2c3e50', title: '🚀 Welcome Aboard', description: 'Houston, we have a new member. Welcome to the crew, {user}!', footer: 'To infinity' },
  { name: 'Welcome Emoji Party', category: 'Welcome', emoji: '🎉', color: '#f47fff', title: '🎉🎊 Welcome!! 🎊🎉', description: 'Everybody say hi to {user}! 👋 The party just got bigger.', footer: 'Let\'s celebrate' },
  { name: 'Welcome Minimal', category: 'Welcome', emoji: '✨', color: '#95a5a6', title: 'Welcome', description: '{user} joined the server.', footer: '{server}' },
  { name: 'Welcome Anime', category: 'Welcome', emoji: '🌸', color: '#ff6ac1', title: '🌸 Irasshaimase!', description: 'Welcome, {user}-chan! We hope you love it here. (◕‿◕)', footer: 'Yoroshiku' },
  { name: 'Welcome Server Info', category: 'Welcome', emoji: '📋', color: '#16a085', title: '📋 Welcome + Quick Start', description: 'Welcome {user}! 1️⃣ Read the rules 2️⃣ Grab roles 3️⃣ Introduce yourself. Have fun!', footer: 'Quick start guide' },

  // ---- Rules (8) ----
  { name: 'Rules Classic', category: 'Rules', emoji: '📜', color: '#e74c3c', title: '📜 Server Rules', description: '1. Be respectful\n2. No spam\n3. No NSFW\n4. Follow Discord ToS\n5. Listen to staff', footer: 'Breaking rules = consequences' },
  { name: 'Rules Friendly', category: 'Rules', emoji: '🤝', color: '#2ecc71', title: '🤝 House Rules', description: "Keep it kind, keep it clean, keep it fun. Treat others how you'd like to be treated!", footer: 'Thanks for understanding' },
  { name: 'Rules Strict', category: 'Rules', emoji: '⚖️', color: '#2c3e50', title: '⚖️ Community Guidelines', description: 'Violations are handled on a strike system: warn → mute → kick → ban. No exceptions.', footer: 'Read carefully' },
  { name: 'Rules Gaming', category: 'Rules', emoji: '🎮', color: '#9b59b6', title: '🎮 Squad Rules', description: 'No cheating, no rage-quitting on teammates, no toxicity. GG only.', footer: 'Respect the game' },
  { name: 'Rules TL;DR', category: 'Rules', emoji: '📝', color: '#f39c12', title: '📝 Rules (TL;DR)', description: "Don't be a jerk. That's basically it. Full rules in the pinned message.", footer: 'Simple as that' },
  { name: 'Rules Verification', category: 'Rules', emoji: '✅', color: '#3498db', title: '✅ Verify to Continue', description: 'React below to confirm you\'ve read the rules and unlock the rest of the server.', footer: 'One click away' },
  { name: 'Rules NSFW Warning', category: 'Rules', emoji: '🔞', color: '#c0392b', title: '🔞 Age-Restricted Zone', description: 'Some channels are 18+. By entering you confirm you meet the age requirement.', footer: 'Stay safe' },
  { name: 'Rules Zero Tolerance', category: 'Rules', emoji: '🚫', color: '#e74c3c', title: '🚫 Zero Tolerance', description: 'Hate speech, harassment, and slurs result in an instant permanent ban. Full stop.', footer: 'No warnings for this' },

  // ---- Events (10) ----
  { name: 'Event General', category: 'Events', emoji: '🎪', color: '#e91e63', title: '🎪 Upcoming Event', description: "Join us for a special event! Details, date, and time below. Don't miss out!", footer: 'RSVP by reacting' },
  { name: 'Movie Night', category: 'Events', emoji: '🎬', color: '#8e44ad', title: '🎬 Movie Night', description: "Grab your popcorn! We're watching a movie together this weekend. Vote for the film below.", footer: 'Popcorn provided (BYO)' },
  { name: 'Game Night', category: 'Events', emoji: '🕹️', color: '#2ecc71', title: '🕹️ Game Night', description: "It's game night! Hop in voice and let's play. All skill levels welcome.", footer: 'GLHF' },
  { name: 'Tournament', category: 'Events', emoji: '🏆', color: '#ffd23f', title: '🏆 Tournament Time', description: 'Sign up now for our tournament. Prizes for the top players!', footer: 'Bracket posts soon' },
  { name: 'AMA', category: 'Events', emoji: '🎤', color: '#3498db', title: '🎤 Ask Me Anything', description: "Got questions? We're hosting an AMA — drop your questions and we'll answer live.", footer: 'No question too small' },
  { name: 'Watch Party', category: 'Events', emoji: '📺', color: '#e67e22', title: '📺 Watch Party', description: "We're streaming together! Join the party and hang out.", footer: 'Snacks recommended' },
  { name: 'Community Meetup', category: 'Events', emoji: '🌐', color: '#16a085', title: '🌐 Community Meetup', description: "Let's all hang out and get to know each other. Everyone's invited!", footer: 'Bring good vibes' },
  { name: 'Launch Party', category: 'Events', emoji: '🎉', color: '#f47fff', title: '🎉 Launch Party', description: "We're celebrating a big launch! Come join the festivities.", footer: 'Cake not included' },
  { name: 'Contest', category: 'Events', emoji: '🥇', color: '#d35400', title: '🥇 Contest Alert', description: 'Show off your skills and win! Submit your entry before the deadline.', footer: 'May the best win' },
  { name: 'Countdown', category: 'Events', emoji: '⏰', color: '#c0392b', title: '⏰ The Countdown Begins', description: 'The big day is almost here! Are you ready?', footer: 'Tick tock' },

  // ---- Giveaways (8) ----
  { name: 'Giveaway Hype', category: 'Giveaways', emoji: '🎉', color: '#e91e63', title: '🎉 GIVEAWAY 🎉', description: '**Prize:** {prize}\nReact 🎉 to enter! Winner announced soon. Good luck everyone!', footer: 'One entry per person' },
  { name: 'Nitro Giveaway', category: 'Giveaways', emoji: '💎', color: '#5865f2', title: '💎 Discord Nitro Giveaway', description: 'We\'re giving away Nitro! Enter below for your chance to win.', footer: 'Must be in the server' },
  { name: 'Giveaway Requirements', category: 'Giveaways', emoji: '📋', color: '#3498db', title: '📋 Giveaway (with requirements)', description: 'To enter: ✅ be in the server, ✅ react below, ✅ have the member role.', footer: 'Good luck!' },
  { name: 'Flash Giveaway', category: 'Giveaways', emoji: '⚡', color: '#f39c12', title: '⚡ FLASH GIVEAWAY', description: 'Quick one! This giveaway ends fast — enter NOW before it\'s gone.', footer: 'Blink and you miss it' },
  { name: 'Milestone Giveaway', category: 'Giveaways', emoji: '🎯', color: '#2ecc71', title: '🎯 Milestone Giveaway', description: 'To celebrate reaching a milestone, we\'re giving back to YOU. Enter below!', footer: 'Thanks for the support' },
  { name: 'Winner Announcement', category: 'Giveaways', emoji: '🏆', color: '#ffd23f', title: '🏆 We Have a Winner!', description: 'Congratulations {user}! 🎉 You won the giveaway. Please open a ticket to claim.', footer: 'Thanks to all who entered' },
  { name: 'Giveaway Ended', category: 'Giveaways', emoji: '🔚', color: '#95a5a6', title: '🔚 Giveaway Ended', description: 'This giveaway has ended. Thanks to everyone who participated — stay tuned for the next one!', footer: 'More coming soon' },
  { name: 'Reroll Notice', category: 'Giveaways', emoji: '🔁', color: '#9b59b6', title: '🔁 Reroll', description: 'The previous winner didn\'t claim in time, so we picked a new winner!', footer: 'Claim within 24h' },

  // ---- Updates (8) ----
  { name: 'Bot Update', category: 'Updates', emoji: '🤖', color: '#5865f2', title: '🤖 Bot Update', description: 'The bot just got an update! New commands and improvements are live.', footer: 'Type /help to explore' },
  { name: 'Patch Notes', category: 'Updates', emoji: '🩹', color: '#2ecc71', title: '🩹 Patch Notes', description: '• Fixed a few bugs\n• Improved performance\n• Added quality-of-life tweaks', footer: 'Thanks for the reports' },
  { name: 'Changelog', category: 'Updates', emoji: '📝', color: '#3498db', title: '📝 What\'s New', description: 'Here\'s what changed in the latest version. Read the full changelog for details.', footer: 'v2.0' },
  { name: 'Roadmap', category: 'Updates', emoji: '🗺️', color: '#e67e22', title: '🗺️ Roadmap', description: 'Here\'s what we\'re working on next. Your feedback shapes what we build!', footer: 'Subject to change' },
  { name: 'Server Revamp', category: 'Updates', emoji: '🏗️', color: '#f39c12', title: '🏗️ Server Revamp', description: 'We reorganized channels and roles to make things cleaner. Take a look around!', footer: 'Fresh new look' },
  { name: 'New Channels', category: 'Updates', emoji: '➕', color: '#16a085', title: '➕ New Channels Added', description: 'We added some new channels for you to enjoy. Go check them out!', footer: 'More space to chat' },
  { name: 'Feature Removed', category: 'Updates', emoji: '➖', color: '#95a5a6', title: '➖ Feature Sunset', description: 'We\'re retiring an old feature to make room for better ones. Thanks for understanding.', footer: 'Out with the old' },
  { name: 'Beta Access', category: 'Updates', emoji: '🧪', color: '#9b59b6', title: '🧪 Beta Access', description: 'Want to try new features early? React below to join the beta testers!', footer: 'Bugs may occur' },

  // ---- Maintenance (6) ----
  { name: 'Scheduled Maintenance', category: 'Maintenance', emoji: '🛠️', color: '#f39c12', title: '🛠️ Scheduled Maintenance', description: 'The bot will be down briefly for maintenance. We\'ll be back shortly!', footer: 'Sorry for the inconvenience' },
  { name: 'Downtime Notice', category: 'Maintenance', emoji: '⚠️', color: '#e74c3c', title: '⚠️ Downtime Notice', description: 'We\'re experiencing some downtime and working to fix it ASAP.', footer: 'Thanks for your patience' },
  { name: 'Back Online', category: 'Maintenance', emoji: '✅', color: '#2ecc71', title: '✅ Back Online', description: 'Everything\'s back up and running! Thanks for waiting.', footer: 'All systems go' },
  { name: 'Under Construction', category: 'Maintenance', emoji: '🚧', color: '#f1c40f', title: '🚧 Under Construction', description: 'This area is being worked on. Pardon our dust!', footer: 'Coming together soon' },
  { name: 'Emergency Notice', category: 'Maintenance', emoji: '🚨', color: '#c0392b', title: '🚨 Emergency Notice', description: 'We\'re dealing with an urgent issue. Please stand by for updates.', footer: 'Updates incoming' },
  { name: 'Status Update', category: 'Maintenance', emoji: '📡', color: '#3498db', title: '📡 Status Update', description: 'Current status: all services operational. We\'ll post here if anything changes.', footer: 'Monitoring closely' },

  // ---- Polls (8) ----
  { name: 'Simple Poll', category: 'Polls', emoji: '📊', color: '#3498db', title: '📊 Quick Poll', description: 'What do you think? React 👍 for yes, 👎 for no.', footer: 'Your opinion counts' },
  { name: 'This or That', category: 'Polls', emoji: '⚔️', color: '#e91e63', title: '⚔️ This or That', description: 'Pick a side! 🅰️ Option A vs 🅱️ Option B. React to vote.', footer: 'Choose wisely' },
  { name: 'Rating Poll', category: 'Polls', emoji: '⭐', color: '#ffd23f', title: '⭐ Rate It', description: 'How would you rate this? React 1️⃣ to 5️⃣.', footer: 'Be honest' },
  { name: 'Feature Request', category: 'Polls', emoji: '💡', color: '#2ecc71', title: '💡 Which Feature Next?', description: 'Help us prioritize! Vote for the feature you want most.', footer: 'We build what you vote' },
  { name: 'Event Time Poll', category: 'Polls', emoji: '🕐', color: '#9b59b6', title: '🕐 Best Time?', description: 'When should we host the next event? React with your preferred time.', footer: 'Majority wins' },
  { name: 'Yes/No/Maybe', category: 'Polls', emoji: '🤔', color: '#f39c12', title: '🤔 What Do You Think?', description: '✅ Yes  •  ❌ No  •  🤷 Maybe. Cast your vote!', footer: 'No wrong answers' },
  { name: 'Tier List', category: 'Polls', emoji: '🏅', color: '#e67e22', title: '🏅 Tier List Vote', description: 'Where does it rank? React S, A, B, or C tier.', footer: 'Debate in the comments' },
  { name: 'Weekly Question', category: 'Polls', emoji: '❓', color: '#16a085', title: '❓ Question of the Week', description: 'Here\'s this week\'s question — drop your answer below!', footer: 'New question every week' },

  // ---- Partnerships (6) ----
  { name: 'Partner Announcement', category: 'Partnerships', emoji: '🤝', color: '#5865f2', title: '🤝 New Partner', description: 'We\'ve partnered with an awesome community! Go check them out and show some love.', footer: 'Better together' },
  { name: 'Partner Requirements', category: 'Partnerships', emoji: '📋', color: '#3498db', title: '📋 Partnership Requirements', description: 'Want to partner with us? You\'ll need 50+ members and an active community. DM staff!', footer: 'We reply to all' },
  { name: 'Sponsor Thanks', category: 'Partnerships', emoji: '💝', color: '#e91e63', title: '💝 Thanks to Our Sponsor', description: 'A big shoutout to our sponsor for making this possible!', footer: 'Support the sponsors' },
  { name: 'Collaboration', category: 'Partnerships', emoji: '🌉', color: '#9b59b6', title: '🌉 Collab Time', description: 'We\'re teaming up for something special. Details soon!', footer: 'Two communities, one event' },
  { name: 'Affiliate Program', category: 'Partnerships', emoji: '🔗', color: '#2ecc71', title: '🔗 Affiliate Program', description: 'Join our affiliate program and grow together. Apply below.', footer: 'Mutual growth' },
  { name: 'Cross-Promo', category: 'Partnerships', emoji: '📣', color: '#f39c12', title: '📣 Featured Community', description: 'This week we\'re featuring a partner community we love. Check them out!', footer: 'Spread the love' },

  // ---- Moderation (8) ----
  { name: 'Warning Notice', category: 'Moderation', emoji: '⚠️', color: '#f39c12', title: '⚠️ Warning', description: 'This is a formal warning. Please review the rules and adjust your behavior.', footer: 'Further action may follow' },
  { name: 'Ban Announcement', category: 'Moderation', emoji: '🔨', color: '#e74c3c', title: '🔨 Ban Notice', description: 'A user has been banned for violating server rules.', footer: 'Rules apply to everyone' },
  { name: 'Mute Notice', category: 'Moderation', emoji: '🔇', color: '#95a5a6', title: '🔇 Timeout Issued', description: 'A user has been timed out. Normal service resumes shortly.', footer: 'Cool-down time' },
  { name: 'Report Instructions', category: 'Moderation', emoji: '🚩', color: '#c0392b', title: '🚩 How to Report', description: 'See something wrong? Open a ticket or DM a staff member. We take reports seriously.', footer: 'Keep it confidential' },
  { name: 'Appeal Info', category: 'Moderation', emoji: '📨', color: '#3498db', title: '📨 Ban Appeals', description: 'Think a punishment was a mistake? You can appeal through our appeals form.', footer: 'Appeals reviewed fairly' },
  { name: 'Staff Reminder', category: 'Moderation', emoji: '👮', color: '#2c3e50', title: '👮 Staff Reminder', description: 'A friendly reminder to keep the chat civil. Staff are always watching.', footer: 'Play nice' },
  { name: 'Slowmode On', category: 'Moderation', emoji: '🐢', color: '#16a085', title: '🐢 Slowmode Enabled', description: 'Chat is moving fast — slowmode is temporarily on to keep things readable.', footer: 'Take your time' },
  { name: 'Lockdown Notice', category: 'Moderation', emoji: '🔒', color: '#e74c3c', title: '🔒 Channel Locked', description: 'This channel is temporarily locked. It will reopen shortly.', footer: 'Thanks for understanding' },

  // ---- Holidays (12) ----
  { name: 'New Year', category: 'Holidays', emoji: '🎆', color: '#ffd23f', title: '🎆 Happy New Year!', description: 'Wishing everyone in **{server}** an amazing year ahead. Cheers! 🥂', footer: 'New year, new adventures' },
  { name: 'Valentine\'s', category: 'Holidays', emoji: '💝', color: '#e91e63', title: '💝 Happy Valentine\'s Day', description: 'Sending love to our wonderful community today. 💕', footer: 'You\'re appreciated' },
  { name: 'St. Patrick\'s', category: 'Holidays', emoji: '☘️', color: '#2ecc71', title: '☘️ Happy St. Patrick\'s Day', description: 'Luck of the Irish to you all! 🍀', footer: 'Stay lucky' },
  { name: 'Easter', category: 'Holidays', emoji: '🐰', color: '#f47fff', title: '🐰 Happy Easter', description: 'Hoppy Easter, everyone! Enjoy the day. 🥚', footer: 'Egg-cellent vibes' },
  { name: 'Halloween', category: 'Holidays', emoji: '🎃', color: '#e67e22', title: '🎃 Happy Halloween', description: 'Trick or treat! Spooky season is here. 👻', footer: 'Stay spooky' },
  { name: 'Thanksgiving', category: 'Holidays', emoji: '🦃', color: '#d35400', title: '🦃 Happy Thanksgiving', description: 'We\'re thankful for each and every one of you. 🧡', footer: 'Gratitude all around' },
  { name: 'Christmas', category: 'Holidays', emoji: '🎄', color: '#e74c3c', title: '🎄 Merry Christmas', description: 'Warmest wishes to **{server}** this holiday season! 🎁', footer: 'Ho ho ho' },
  { name: 'Summer', category: 'Holidays', emoji: '☀️', color: '#f1c40f', title: '☀️ Summer Vibes', description: 'Summer is here! Stay cool and have fun. 🏖️', footer: 'Sunshine season' },
  { name: 'Anniversary', category: 'Holidays', emoji: '🎂', color: '#9b59b6', title: '🎂 Server Anniversary', description: 'Today marks another year of **{server}**! Thank you for being part of the journey. 🎉', footer: 'Here\'s to many more' },
  { name: 'Birthday', category: 'Holidays', emoji: '🎈', color: '#3498db', title: '🎈 Happy Birthday!', description: 'Happy birthday, {user}! 🥳 Hope your day is amazing.', footer: 'Make a wish' },
  { name: 'Pride', category: 'Holidays', emoji: '🏳️‍🌈', color: '#e91e63', title: '🏳️‍🌈 Happy Pride', description: 'This community celebrates and welcomes everyone. Love is love. 💖', footer: 'All are welcome' },
  { name: 'Lunar New Year', category: 'Holidays', emoji: '🧧', color: '#c0392b', title: '🧧 Happy Lunar New Year', description: 'Wishing you prosperity and joy in the new year! 🐉', footer: 'Gong Xi Fa Cai' },

  // ---- Gaming (10) ----
  { name: 'LFG', category: 'Gaming', emoji: '🎮', color: '#2ecc71', title: '🎮 Looking for Group', description: 'Anyone up to play? Drop your game and rank below and let\'s squad up!', footer: 'Teamwork makes the dream work' },
  { name: 'Scrim Announcement', category: 'Gaming', emoji: '🥊', color: '#e74c3c', title: '🥊 Scrim Tonight', description: 'Practice match scheduled! Confirm your attendance below.', footer: 'Warm up first' },
  { name: 'Server IP', category: 'Gaming', emoji: '🖥️', color: '#16a085', title: '🖥️ Game Server Info', description: 'Join our game server! IP and connection details below.', footer: 'See you in-game' },
  { name: 'Patch Reaction', category: 'Gaming', emoji: '🩹', color: '#3498db', title: '🩹 New Game Patch', description: 'A new patch dropped! Discuss the changes and share your thoughts.', footer: 'Meta shift incoming' },
  { name: 'Clan Recruitment', category: 'Gaming', emoji: '⚔️', color: '#9b59b6', title: '⚔️ Clan Recruitment', description: 'We\'re recruiting! Active players wanted. React to apply.', footer: 'Glory awaits' },
  { name: 'Speedrun', category: 'Gaming', emoji: '⏱️', color: '#f39c12', title: '⏱️ Speedrun Challenge', description: 'Think you\'re fast? Post your best time and claim the throne!', footer: 'Gotta go fast' },
  { name: 'Free Game Alert', category: 'Gaming', emoji: '🎁', color: '#e91e63', title: '🎁 Free Game Alert', description: 'A game is free right now — grab it before the deal ends!', footer: 'Free is the best price' },
  { name: 'Ranked Push', category: 'Gaming', emoji: '📈', color: '#e67e22', title: '📈 Ranked Grind', description: 'Climbing the ladder tonight! Join up and let\'s rank up together.', footer: 'To the top' },
  { name: 'Boss Raid', category: 'Gaming', emoji: '🐉', color: '#c0392b', title: '🐉 Raid Assemble', description: 'The boss awaits. Gather your party and prepare for battle!', footer: 'Loot incoming' },
  { name: 'Highlight Clip', category: 'Gaming', emoji: '🎬', color: '#8e44ad', title: '🎬 Clip of the Week', description: 'Got an insane play? Share your best clip and get featured!', footer: 'Highlight reel' },

  // ---- Support (7) ----
  { name: 'Support Hours', category: 'Support', emoji: '🕐', color: '#3498db', title: '🕐 Support Hours', description: 'Our support team is available during posted hours. Open a ticket any time!', footer: 'We\'ll get back to you' },
  { name: 'Open a Ticket', category: 'Support', emoji: '🎫', color: '#5865f2', title: '🎫 Need Help?', description: 'Click the button below to open a private ticket with our staff team.', footer: 'We\'re here to help' },
  { name: 'FAQ Pointer', category: 'Support', emoji: '❓', color: '#2ecc71', title: '❓ Check the FAQ', description: 'Most questions are answered in our FAQ. Take a look before opening a ticket!', footer: 'Quick answers' },
  { name: 'Bug Report', category: 'Support', emoji: '🐛', color: '#e74c3c', title: '🐛 Found a Bug?', description: 'Report bugs here with steps to reproduce. Screenshots help a ton!', footer: 'Thanks for helping' },
  { name: 'Feedback', category: 'Support', emoji: '💬', color: '#f39c12', title: '💬 We Want Your Feedback', description: 'Tell us how we\'re doing! Your feedback makes the community better.', footer: 'All feedback read' },
  { name: 'Contact Staff', category: 'Support', emoji: '📩', color: '#9b59b6', title: '📩 Contact Staff', description: 'Need to reach a human? DM any staff member or open a ticket.', footer: 'Real people, real help' },
  { name: 'Suggestion Box', category: 'Support', emoji: '📮', color: '#16a085', title: '📮 Suggestion Box', description: 'Got an idea to improve the server? Drop it in the suggestions channel!', footer: 'We love ideas' },

  // ---- Community (7) ----
  { name: 'Introduce Yourself', category: 'Community', emoji: '🙋', color: '#2ecc71', title: '🙋 Introduce Yourself', description: 'New here? Tell us your name, hobbies, and what brought you to **{server}**!', footer: 'Say hi' },
  { name: 'Self Roles', category: 'Community', emoji: '🎨', color: '#9b59b6', title: '🎨 Grab Your Roles', description: 'React below to pick your roles and customize your experience!', footer: 'Express yourself' },
  { name: 'Shoutout', category: 'Community', emoji: '📣', color: '#e91e63', title: '📣 Community Shoutout', description: 'Big shoutout to our amazing members who keep this place awesome!', footer: 'You\'re the best' },
  { name: 'Member of the Week', category: 'Community', emoji: '🌟', color: '#ffd23f', title: '🌟 Member of the Week', description: 'Congrats to this week\'s standout member! Thanks for being awesome. 🎉', footer: 'Who\'s next?' },
  { name: 'Daily Chat Starter', category: 'Community', emoji: '💭', color: '#3498db', title: '💭 Chat Starter', description: 'What\'s one thing that made you smile today? Share below! 😊', footer: 'Let\'s talk' },
  { name: 'Server Stats', category: 'Community', emoji: '📈', color: '#16a085', title: '📈 Server Stats', description: 'Look how far we\'ve come! Here are our latest community numbers.', footer: 'Growing every day' },
  { name: 'Invite Friends', category: 'Community', emoji: '👥', color: '#e67e22', title: '👥 Bring Your Friends', description: 'Know someone who\'d love it here? Share the invite and grow the family!', footer: 'The more the merrier' },
];
