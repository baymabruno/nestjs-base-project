# ---- build ----
FROM node:24.21.0-slim AS build

WORKDIR /var/www/html/
COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build && npm prune --omit=dev --ignore-scripts

# ---- runtime ----
FROM node:24.21.0-slim

LABEL maintainer="Vertex Digital"

ENV NODE_ENV=production \
    TZ=America/Sao_Paulo

RUN npm install pm2 -g

WORKDIR /var/www/html/
COPY --from=build --chown=node:node /var/www/html/package.json ./
COPY --from=build --chown=node:node /var/www/html/node_modules ./node_modules
COPY --from=build --chown=node:node /var/www/html/dist ./dist
COPY --chown=node:node views ./views
COPY --chown=node:node ecosystem.config.js ./
COPY --chown=node:node docker/pm2-logrotate-settings.sh ./docker/
RUN mkdir logs && chown node:node logs

USER node
RUN pm2 install pm2-logrotate && ./docker/pm2-logrotate-settings.sh && pm2 kill

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

CMD ["npm", "run", "start:pm2"]
