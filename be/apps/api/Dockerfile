# nivo-lite/api - the api app. The build context is the APP ROOT (the folder holding the one package.json and
# package-lock.json), not this folder:
#
#   docker build -f be/apps/api/Dockerfile -t nivo-lite/api:<tag> .
#
# It follows the image canon and diverges from it in one place: the runtime installs ffmpeg and fontconfig (apk) because the video
# render job shells out to ffmpeg (libx264, libass, libfreetype, sidechaincompress, loudnorm) and writes its TTS cache and scratch files under
# /var/cache/nivo-video and /tmp/nivo-video, which the unprivileged node user must own. Credentials are mounted at run time and never enter the image.

FROM node:22.14.0-alpine3.21 AS manifests
WORKDIR /app
COPY package.json package-lock.json ./
COPY fe fe
RUN find fe -type f ! -name package.json -delete

FROM node:22.14.0-alpine3.21 AS build
WORKDIR /app
COPY --from=manifests /app ./
RUN npm ci --ignore-scripts

COPY be/tsconfig.json be/tsconfig.build.json be/
COPY be/src be/src
COPY be/apps/api be/apps/api
# The cli app ships in the same image: the stack runs jobs, the watchdog and the seeds as `node be/dist/apps/cli/src/main.js` inside the api service.
COPY be/apps/cli be/apps/cli
RUN npm run build:be

FROM node:22.14.0-alpine3.21 AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN apk add --no-cache ffmpeg fontconfig \
 && mkdir -p /var/cache/nivo-video /tmp/nivo-video \
 && chown node:node /var/cache/nivo-video /tmp/nivo-video

COPY --from=manifests /app ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=build /app/be/dist be/dist
# be/src/assets ships as it sits in the repo: the fonts the video render burns captions with (VIDEO_FONTS_DIR). The music beds are not read from
# here: they live in the media bucket (`cli seed-media upload` writes them from src/assets/media-seed).
COPY be/src/assets be/src/assets
ENV VIDEO_FONTS_DIR=/app/be/src/assets/fonts

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "be/dist/apps/api/src/main.js"]
