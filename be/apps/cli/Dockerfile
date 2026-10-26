# nivo-lite/cli - the cli command app: every one-off action (migrate, seed, sync, backup) is one command of this
# image, run with the command as its arguments, e.g. `docker run --rm nivo-lite/cli:<tag> migrate run`. The build context is
# the APP ROOT (the folder holding the one package.json and package-lock.json), not this folder:
#
#   docker build -f be/apps/cli/Dockerfile -t nivo-lite/cli:<tag> .
#
# It follows the image canon (knowledge/hfs/docker.md) and diverges from it nowhere. No secret is built in: credentials are
# mounted at run time and .dockerignore keeps them out of the build context.

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
COPY --from=manifests /app ./
RUN npm ci --ignore-scripts

COPY be/tsconfig.json be/tsconfig.build.json be/
COPY be/src be/src
COPY be/apps/cli be/apps/cli
RUN npm run build:be

FROM node:22.14.0-alpine3.21 AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=manifests /app ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=build /app/be/dist be/dist

USER node
HEALTHCHECK NONE
ENTRYPOINT ["node", "be/dist/apps/cli/src/main.js"]
CMD ["--help"]
