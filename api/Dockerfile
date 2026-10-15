# Build context: repository root (see docker-compose.yml)
FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY web/package.json web/
# The api postinstall runs `prisma generate`, so the schema must exist before installing.
COPY api/prisma api/prisma
RUN npm ci --workspace api --include-workspace-root
COPY api api
RUN npm run build --workspace api

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/api/package.json api/package.json
COPY --from=build /app/api/prisma api/prisma
COPY --from=build /app/api/dist api/dist
WORKDIR /app/api
EXPOSE 3000
# Apply pending migrations, then start the API.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
