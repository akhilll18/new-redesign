# EZY HR · web app + API server in one image.
#   docker build -t ezy-hr .
#   docker compose up -d          (see docker-compose.yml: PostgreSQL, API, workers, PgBouncer)
FROM node:22-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG SITE_URL=""
RUN SITE_URL="$SITE_URL" npm run build

FROM node:22-alpine
ENV NODE_ENV=production PORT=8080
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server/ ./
COPY src/data /app/src/data
COPY src/lib /app/src/lib
COPY src/country /app/src/country
COPY --from=web /app/dist /app/dist
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/ready || exit 1
CMD ["node", "api/server.mjs"]
