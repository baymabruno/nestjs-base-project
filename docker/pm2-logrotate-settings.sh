pm2 set pm2-logrotate:max_size 500M
pm2 set pm2-logrotate:retain 10
pm2 set pm2-logrotate:compress false
pm2 set dateFormat 'DD-MM-YYYY-HH-mm-ss'
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'