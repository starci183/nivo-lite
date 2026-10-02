# NIVO engine image. Build context = this folder (engine/).
#   docker build -t nivo-engine:local .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
# video.render: ffmpeg (libx264, libass, libfreetype, fontconfig, sidechaincompress, loudnorm) + the TTS cache and render scratch dirs the node user may write.
RUN apk add --no-cache ffmpeg fontconfig  && mkdir -p /var/cache/nivo-video /tmp/nivo-video  && chown node:node /var/cache/nivo-video /tmp/nivo-video
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
# Bundled Be Vietnam Pro (SIL OFL, see assets/video/fonts/OFL.txt) and the royalty-free music beds (assets/video/music/LICENSE.md).
COPY --chown=node:node assets ./assets
USER node
EXPOSE 8787
# Liveness only (process-local): never depends on Supabase or OpenClaw, so their outage does not restart a healthy engine.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.ENGINE_PORT||8787)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# SIGTERM from `docker stop` reaches node directly and triggers the graceful shutdown (running jobs finish or are handed back).
CMD ["node", "dist/main.js"]
