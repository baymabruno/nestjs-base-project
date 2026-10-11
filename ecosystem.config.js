const { join } = require('path');

const logFile = join(__dirname, 'logs', 'api.log');

module.exports = {
  apps: [
    {
      name: 'node-backend',
      script: 'dist/main.js',
      cwd: __dirname,
      // number of processes; 'max' runs one per CPU core
      instances: process.env.PM2_INSTANCES || 1,
      exec_mode: 'cluster',
      max_memory_restart: '512M',
      // time for the app to finish in-flight requests on stop/reload before
      // PM2 kills it (the default is 1.6s)
      kill_timeout: 10000,
      error_file: logFile,
      out_file: logFile,
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        TZ: 'America/Sao_Paulo',
      },
    },
  ],
};
