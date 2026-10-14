# nivo-lite/web - the web Next app (standalone output). The build context is the APP ROOT (the folder holding the one
# package.json and package-lock.json), not this folder:
#
#   docker build -f fe/apps/web/Dockerfile -t nivo-lite/web:<tag> .
#
# Pass the public values with --build-arg: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_API_URL (default https://api.nivo.vn), NEXT_PUBLIC_DEVELOPER_API_URL (default https://api.nivo.vn),
# NEXT_PUBLIC_SITE_URL (default https://nivo.vn) and the optional demo-login and Google Picker values.
#
# NEXT_PUBLIC_* values are published to every browser by design, so they are the one kind of build argument; every server-only
# variable is supplied at run time (env_file). It follows the image canon (knowledge/hfs/docker.md) and diverges from it nowhere.
# No secret is built in: credentials are mounted at run time and .dockerignore keeps them out of the build context.

FROM node:22.14.0-alpine3.21 AS manifests
WORKDIR /app
COPY package.json package-lock.json ./
COPY fe fe
RUN find fe -type f ! -name package.json -delete

FROM node:22.14.0-alpine3.21 AS build
WORKDIR /app
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL=https://api.nivo.vn
ARG NEXT_PUBLIC_DEVELOPER_API_URL=https://api.nivo.vn
ARG NEXT_PUBLIC_SITE_URL=https://nivo.vn
ARG NEXT_PUBLIC_DEMO_LOGIN=
# Google Picker (public values; the button hides when any is empty).
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ARG NEXT_PUBLIC_GOOGLE_PICKER_API_KEY=
ARG NEXT_PUBLIC_GOOGLE_APP_ID=
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_DEVELOPER_API_URL=$NEXT_PUBLIC_DEVELOPER_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_DEMO_LOGIN=$NEXT_PUBLIC_DEMO_LOGIN \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_PUBLIC_GOOGLE_PICKER_API_KEY=$NEXT_PUBLIC_GOOGLE_PICKER_API_KEY \
    NEXT_PUBLIC_GOOGLE_APP_ID=$NEXT_PUBLIC_GOOGLE_APP_ID \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=manifests /app ./
RUN npm ci --ignore-scripts

COPY turbo.json ./
COPY scripts scripts
COPY be/contracts be/contracts
COPY supabase/types supabase/types
COPY supabase/migrations supabase/migrations
COPY fe/tsconfig.json fe/tsconfig.json
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
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/login').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "fe/apps/web/server.js"]
