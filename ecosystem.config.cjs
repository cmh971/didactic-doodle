// PM2 process config for the Sentinel bot.
// Start:   pm2 start ecosystem.config.cjs
// Restart: pm2 restart sentinel      (this is the one-command restart)
// Logs:    pm2 logs sentinel
// Status:  pm2 status
module.exports = {
  apps: [
    {
      name: 'sentinel',
      script: 'index.js',
      cwd: __dirname,
      autorestart: true, // self-heal if it crashes
      max_restarts: 30,
      restart_delay: 4000, // wait 4s between crash-restarts (avoids hammering Discord)
      watch: false,
      time: true, // timestamp log lines
      max_memory_restart: '600M',
    },
  ],
};
