module.exports = [
  {
    name: 'node-backend',
    script: 'dist/main.js',
    error_file: '~/.pm2/logs/production.log',
    out_file: '~/.pm2/logs/production.log',
  },
];
