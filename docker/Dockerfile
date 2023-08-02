FROM node:20.5.0-buster

LABEL maintainer="Vertex Digital"

WORKDIR /var/www/html/
COPY package*.json ./
RUN npm install
COPY . .

CMD ["node", "index.js"]

RUN npm run build