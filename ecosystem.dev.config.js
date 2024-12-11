module.exports = [
  {
    name: 'node-backend',
    script: './docker/pm2-logrotate-settings.sh && nest start --debug --watch',
    error_file: '/var/www/html/logs/api.log',
    out_file: '/var/www/html/logs/api.log',
    env: {
      TZ: 'America/Sao_Paulo',
    },
  },
];
