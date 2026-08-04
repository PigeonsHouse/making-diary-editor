FROM node:20-bookworm-slim AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
EXPOSE 3000
CMD ["node", "server.js"]

FROM base AS migrate
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY drizzle ./drizzle
COPY scripts/migrate.ts ./scripts/migrate.ts
CMD ["./node_modules/.bin/tsx", "scripts/migrate.ts"]

FROM base AS worker
RUN apt-get update && apt-get install -y --no-install-recommends chromium ffmpeg fonts-noto-cjk && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV CHROMIUM_PATH=/usr/bin/chromium
ENV REMOTION_BUNDLE_DIR=/app/.remotion-bundle
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm worker:bundle
CMD ["pnpm", "worker"]
