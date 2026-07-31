# Build from the repo root: docker build -f apps/web/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace @arcadia/web --include-workspace-root

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @arcadia/web

FROM nginx:alpine
# templates/ is processed by nginx's entrypoint with envsubst at startup —
# only ${VARS} that exist in the environment are substituted, nginx's own
# $host/$uri variables are left alone.
COPY apps/web/nginx.conf /etc/nginx/templates/default.conf.template
ENV API_PROXY_TARGET=http://api:3000
ENV API_DNS_RESOLVER=127.0.0.11
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
