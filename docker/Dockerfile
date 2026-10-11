# Base images are pinned by digest (reproducible builds); Dependabot keeps
# them up to date.

# ---- build ----
FROM node:24.21.0-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS build

WORKDIR /var/www/html/
COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build && npm prune --omit=dev --ignore-scripts

# ---- runtime ----
FROM node:24.21.0-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20

LABEL maintainer="Vertex Digital"

# commit of the build, reported as the release by @nestjs/observe
ARG GIT_SHA=""

ENV NODE_ENV=production \
    TZ=America/Sao_Paulo \
    OBSERVE_SERVICE_VERSION=$GIT_SHA \
    PATH=/var/www/html/node_modules/.bin:$PATH

# security fixes of the system packages
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html/
COPY --from=build --chown=node:node /var/www/html/package.json ./
COPY --from=build --chown=node:node /var/www/html/node_modules ./node_modules
COPY --from=build --chown=node:node /var/www/html/dist ./dist
COPY --chown=node:node views ./views
COPY --chown=node:node ecosystem.config.cjs ./
COPY --chown=node:node docker/pm2-logrotate-*.sh ./docker/
RUN mkdir logs && chown node:node logs

USER node
RUN ./docker/pm2-logrotate-install.sh

# npm is not used at runtime: removing it leaves its dependencies (and their
# vulnerabilities) out of the image
USER root
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

CMD ["pm2-runtime", "start", "ecosystem.config.cjs"]
