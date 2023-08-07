FROM node:20.5.0-buster

LABEL maintainer="Vertex Digital"

WORKDIR /var/www/html/
COPY package*.json ./
RUN npm install
COPY . .

RUN npm install pm2 -g
RUN pm2 install pm2-logrotate

# CMD ["node", "index.js"]
CMD ["pm2-runtime", "main.js"]

RUN npm run build