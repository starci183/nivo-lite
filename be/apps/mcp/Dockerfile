# nivo-lite/mcp - the NIVO MCP gateway app: one MCP endpoint (Streamable HTTP) per workspace in front of every
# connector (POST /mcp/<workspaceId>), with the grants, approvals, limits and audit of the gateway modules. The build context is
# the APP ROOT (the folder holding the one package.json and package-lock.json), not this folder:
#
#   docker build -f be/apps/mcp/Dockerfile -t nivo-lite/mcp:<tag> .
#
# It follows the image canon (knowledge/hfs/docker.md) and diverges from it nowhere. No secret is built in: credentials are
# mounted at run time and .dockerignore keeps them out of the build context.

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
COPY be/apps/mcp be/apps/mcp
RUN npm run build:be

FROM node:22.14.0-alpine3.21 AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=manifests /app ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=build /app/be/dist be/dist

USER node
HEALTHCHECK NONE
ENTRYPOINT ["node", "be/dist/apps/mcp/src/main.js"]
