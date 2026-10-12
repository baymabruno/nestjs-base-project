const { join } = require('path');

const logFile = join(__dirname, 'logs', 'api.log');

module.exports = {
  apps: [
    {
      name: 'node-backend',
      script: 'node_modules/@nestjs/cli/bin/nest.js',
      args: 'start --debug 0.0.0.0:9229 --watch',
      cwd: __dirname,
      error_file: logFile,
      out_file: logFile,
      env: {
        TZ: 'America/Sao_Paulo',
      },
    },
    // runs the build of the app above (dist), restarting when it changes; it
    // fails while the first build is not ready and PM2 starts it again
    {
      name: 'worker',
      script: 'dist/worker.js',
      cwd: __dirname,
      watch: ['dist'],
      watch_delay: 2000,
      restart_delay: 3000,
      error_file: logFile,
      out_file: logFile,
      env: {
        TZ: 'America/Sao_Paulo',
      },
    },
  ],
};
