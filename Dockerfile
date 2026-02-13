# Multi-stage build for efficient container size
FROM node:22-alpine AS builder

ARG VERSION="unknown"
ARG COMMIT_SHA="unknown"
ARG BUILD_DATE="unknown"

WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:22-alpine AS production

RUN addgroup -g 1001 -S superops && \
    adduser -S superops -u 1001 -G superops

WORKDIR /app
COPY package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
RUN npm prune --omit=dev && npm cache clean --force
RUN mkdir -p /app/logs && chown -R superops:superops /app
USER superops

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV MCP_TRANSPORT=http
ENV MCP_HTTP_PORT=8080
ENV MCP_HTTP_HOST=0.0.0.0
ENV AUTH_MODE=env

VOLUME ["/app/logs"]
CMD ["node", "dist/index.js"]

LABEL maintainer="engineering@wyre.ai"
LABEL description="SuperOps MCP Server"
LABEL org.opencontainers.image.title="superops-mcp"
LABEL org.opencontainers.image.source="https://github.com/wyre-technology/superops-mcp"
LABEL org.opencontainers.image.vendor="Wyre Technology"
LABEL org.opencontainers.image.licenses="Apache-2.0"
