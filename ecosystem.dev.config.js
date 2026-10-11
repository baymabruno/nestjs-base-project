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
  ],
};
