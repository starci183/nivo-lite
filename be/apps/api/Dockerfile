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
COPY supabase/types supabase/types
COPY be/apps/api be/apps/api
# The generated database types live outside be/ (supabase/types), which widens the compiler root: tsc then writes be/dist/be/... and be/dist/supabase/...
# and tsc-alias, which expects be/dist/src/..., leaves the path aliases unresolved. The import is type-only, so nothing at run time needs the
# second tree: flatten the output so the entry sits where the canon says (be/dist/apps/<app>/src/main.js) and resolve the aliases on the flat tree.
RUN npm run build:be && if [ -d be/dist/be ]; then cp -r be/dist/be/. be/dist/ && rm -rf be/dist/be be/dist/supabase && cd be && ../node_modules/.bin/tsc-alias -p tsconfig.build.json; fi

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

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "be/dist/apps/api/src/main.js"]
