module.exports = {
  apps: [{
    name: 'zoom-bots',
    script: 'simpleBatchLauncher-fixed-logic.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      CHROME_PATH: '/usr/bin/google-chrome',
      TOTAL_BOTS: 200,
      MAX_CONCURRENT: 30,
      DELAY_MS: 2000,
      KEEP_ALIVE_MINUTES: 30
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '8G',
    min_uptime: '10s',
    max_restarts: 10
  }]
};

