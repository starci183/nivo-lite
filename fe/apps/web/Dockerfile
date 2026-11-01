# nivo-lite/web - the console Next app on app.nivo.vn (standalone output). The build context is the APP ROOT (the folder holding the one
# package.json and package-lock.json), not this folder:
#
#   docker build -f fe/apps/web/Dockerfile -t nivo-lite/web:<tag> .
#
# Pass the public values with --build-arg: NEXT_PUBLIC_API_URL (default https://api.nivo.vn), NEXT_PUBLIC_DEVELOPER_API_URL (default https://api.nivo.vn),
# NEXT_PUBLIC_SITE_URL (default https://app.nivo.vn), NEXT_PUBLIC_LANDING_URL (default https://nivo.vn). The Google Picker pair
# NEXT_PUBLIC_GOOGLE_CLIENT_ID and NEXT_PUBLIC_GOOGLE_PICKER_API_KEY has no default: the build that passes neither hides the Picker.
#
# NEXT_PUBLIC_* values are published to every browser by design, so they are the one kind of build argument; every server-only
# variable is supplied at run time (env_file). It follows the image canon (knowledge/hfs/docker.md) and diverges from it nowhere.
# No secret is built in: credentials are mounted at run time and .dockerignore keeps them out of the build context.

FROM node:22.14.0-alpine3.21 AS manifests
WORKDIR /app
COPY package.json package-lock.json ./
COPY fe fe
# The install stages hold manifests only, so a workspace `prepare` (it builds dist from sources) has nothing to compile; npm runs it for workspace
# links even under --ignore-scripts. Drop it from these throwaway manifest copies; the build stages copy the sources and manifests back.
RUN find fe -type f ! -name package.json -delete \
 && find fe -name package.json -exec node -e "const fs=require('fs');const f=process.argv[1];const p=JSON.parse(fs.readFileSync(f,'utf8'));if(p.scripts&&p.scripts.prepare){delete p.scripts.prepare;fs.writeFileSync(f,JSON.stringify(p,null,2))}" {} \;

FROM node:22.14.0-alpine3.21 AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=https://api.nivo.vn
ARG NEXT_PUBLIC_DEVELOPER_API_URL=https://api.nivo.vn
ARG NEXT_PUBLIC_SITE_URL=https://app.nivo.vn
ARG NEXT_PUBLIC_LANDING_URL=https://nivo.vn
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ARG NEXT_PUBLIC_GOOGLE_PICKER_API_KEY=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_DEVELOPER_API_URL=$NEXT_PUBLIC_DEVELOPER_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_LANDING_URL=$NEXT_PUBLIC_LANDING_URL \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=manifests /app ./
RUN npm ci --ignore-scripts

COPY turbo.json ./
COPY scripts scripts
COPY be/contracts be/contracts
COPY db/migrations db/migrations
COPY fe/tsconfig.json fe/tsconfig.json
COPY fe/packages fe/packages
COPY fe/apps/web fe/apps/web
RUN mkdir -p fe/apps/web/public
RUN npm run codegen --silent
RUN node_modules/.bin/turbo run build --filter=@nivo-lite/web

FROM node:22.14.0-alpine3.21 AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=build --chown=node:node /app/fe/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/fe/apps/web/.next/static ./fe/apps/web/.next/static
COPY --from=build --chown=node:node /app/fe/apps/web/public ./fe/apps/web/public

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health/live').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "fe/apps/web/server.js"]
