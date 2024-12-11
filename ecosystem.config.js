module.exports = [
  {
    name: 'node-backend',
    script:
      'nest build && ./docker/pm2-logrotate-settings.sh && node dist/main',
    error_file: '/var/www/html/logs/api.log',
    out_file: '/var/www/html/logs/api.log',
    env: {
      TZ: 'America/Sao_Paulo',
    },
  },
];
