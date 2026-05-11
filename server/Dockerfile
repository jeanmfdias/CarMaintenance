FROM node:20-alpine AS builder
WORKDIR /app

# Native deps for better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache tini

ENV NODE_ENV=production \
    PORT=3001 \
    DATABASE_PATH=/app/data/app.db \
    UPLOADS_DIR=/app/data/uploads

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund \
    && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/db/migrations ./dist/db/migrations

RUN mkdir -p /app/data/uploads

EXPOSE 3001
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
