FROM node:20.9.0

LABEL maintainer="Vertex Digital"

WORKDIR /var/www/html/
COPY package*.json ./
RUN npm ci --only=production --ignore-scripts
COPY . .

RUN npm install pm2 -g
RUN pm2 install pm2-logrotate

CMD ["pm2-runtime", "main.js"]

RUN npm run build