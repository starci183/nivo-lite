# The Next.js app as a container for the VPS (Netlify keeps building the same source without this file).
# Build:  docker build -f fe/apps/web/Dockerfile -t nivo-web:TAG \
#           --build-arg NEXT_PUBLIC_SUPABASE_URL=... --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
#           --build-arg NEXT_PUBLIC_SITE_URL=https://nivo.vn --build-arg NEXT_PUBLIC_DEMO_LOGIN=...  .
# NEXT_PUBLIC_* are baked into the client bundle at build time; every server-only variable is supplied at runtime (env_file).
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY fe/apps/web/package.json fe/apps/web/
# --ignore-scripts: the postinstall (module registry generator) needs the sources; npm run build runs it as prebuild.
RUN npm ci --no-audit --no-fund --ignore-scripts

FROM node:22-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL=https://nivo.vn
ARG NEXT_PUBLIC_DEMO_LOGIN=
# Google Picker (public values; the button hides when any is empty).
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ARG NEXT_PUBLIC_GOOGLE_PICKER_API_KEY=
ARG NEXT_PUBLIC_GOOGLE_APP_ID=
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_DEMO_LOGIN=$NEXT_PUBLIC_DEMO_LOGIN \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_PUBLIC_GOOGLE_PICKER_API_KEY=$NEXT_PUBLIC_GOOGLE_PICKER_API_KEY \
    NEXT_PUBLIC_GOOGLE_APP_ID=$NEXT_PUBLIC_GOOGLE_APP_ID \
    NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app ./
# Selective copies: the repo root also holds secrets.env on a developer machine, which must never enter the build context layers.
COPY fe ./fe
COPY scripts ./scripts
# The workspace build keeps any prebuild step (the registry generator) working.
RUN npm run build -w @nivo-lite/web

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NODE_OPTIONS=--max-old-space-size=512
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
# The standalone server of a workspace app sits at its path under the repository root.
COPY --from=build --chown=app:app /app/fe/apps/web/.next/static ./fe/apps/web/.next/static
COPY --from=build --chown=app:app /app/fe/apps/web/public ./fe/apps/web/public
USER app
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=4 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/login || exit 1
CMD ["node", "fe/apps/web/server.js"]
