# nivo-lite/landing - the landing Next app of nivo.vn and www.nivo.vn (standalone output). The build context is the APP ROOT (the folder
# holding the one package.json and package-lock.json), not this folder:
#
#   docker build -f fe/apps/landing/Dockerfile -t nivo-lite/landing:<tag> .
#
# Pass the public values with --build-arg: NEXT_PUBLIC_SITE_URL (default https://nivo.vn) and NEXT_PUBLIC_APP_URL (default https://app.nivo.vn,
# the console every sign-in and try-it action leads to; also the target of the 308 redirects of paths the landing does not own).
#
# NEXT_PUBLIC_* values are published to every browser by design, so they are the one kind of build argument; the landing has no server-only
# variable, no Supabase value and no API address. It follows the image canon (knowledge/hfs/docker.md) and diverges from it nowhere.
# No secret is built in and .dockerignore keeps credentials out of the build context.

FROM node:22.14.0-alpine3.21 AS manifests
WORKDIR /app
COPY package.json package-lock.json ./
COPY fe fe
RUN find fe -type f ! -name package.json -delete

FROM node:22.14.0-alpine3.21 AS build
WORKDIR /app
ARG NEXT_PUBLIC_SITE_URL=https://nivo.vn
ARG NEXT_PUBLIC_APP_URL=https://app.nivo.vn
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL     NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL     NEXT_TELEMETRY_DISABLED=1
COPY --from=manifests /app ./
RUN npm ci --ignore-scripts

COPY turbo.json ./
COPY fe/tsconfig.json fe/tsconfig.json
COPY fe/packages fe/packages
COPY fe/apps/landing fe/apps/landing
RUN mkdir -p fe/apps/landing/public
RUN node_modules/.bin/turbo run build --filter=@nivo-lite/landing

FROM node:22.14.0-alpine3.21 AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=build --chown=node:node /app/fe/apps/landing/.next/standalone ./
COPY --from=build --chown=node:node /app/fe/apps/landing/.next/static ./fe/apps/landing/.next/static
COPY --from=build --chown=node:node /app/fe/apps/landing/public ./fe/apps/landing/public

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health/live').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "fe/apps/landing/server.js"]
