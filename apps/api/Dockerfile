# Build from the repo root: docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /repo

# Install with only the manifests first so Docker layer-caches node_modules
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace @arcadia/api --include-workspace-root

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @arcadia/api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# tsup (noExternal in tsup.config.ts) bundles all deps into dist — no node_modules needed
COPY --from=build /repo/apps/api/dist ./dist
EXPOSE 3000
USER node
CMD ["node", "dist/index.js"]
