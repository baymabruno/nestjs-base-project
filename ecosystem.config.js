module.exports = [
  {
    name: 'node-backend',
    script: 'dist/main.js',
    error_file: '/var/www/html/logs/api.log',
    out_file: '/var/www/html/logs/api.log',
    log_date_format: '[Y-m-d H:i:s]',
  },
];
