# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=making-diary-pnpm-store,target=/pnpm/store,sharing=locked \
    pnpm install --frozen-lockfile --prefer-offline --store-dir=/pnpm/store

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY package.json next.config.ts next-env.d.ts tsconfig.json ./
COPY public ./public
COPY src ./src
RUN --mount=type=cache,id=making-diary-next-cache,target=/app/.next/cache,sharing=locked \
    pnpm build

FROM base AS app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY drizzle ./drizzle
EXPOSE 3000
CMD ["node", "server.js"]

FROM base AS migrate
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY drizzle ./drizzle
COPY scripts/migrate.ts ./scripts/migrate.ts
CMD ["./node_modules/.bin/tsx", "scripts/migrate.ts"]

FROM base AS worker
RUN rm -f /etc/apt/apt.conf.d/docker-clean
RUN --mount=type=cache,id=making-diary-apt-cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,id=making-diary-apt-lists,target=/var/lib/apt/lists,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends chromium ffmpeg fonts-noto-cjk
ENV NODE_ENV=production
ENV CHROMIUM_PATH=/usr/bin/chromium
ENV REMOTION_BUNDLE_DIR=/app/.remotion-bundle
COPY --from=deps /app/node_modules ./node_modules

# Only files used by the Remotion bundle are copied before bundling.
COPY package.json tsconfig.json ./
COPY src/domain ./src/domain
COPY src/remotion ./src/remotion
COPY src/app/styles/remotion.css ./src/app/styles/remotion.css
COPY src/worker/build-remotion-bundle.ts src/worker/remotion-bundler.ts ./src/worker/
RUN pnpm worker:bundle

# Worker and server-only changes keep the prebuilt Remotion bundle layer cached.
COPY src ./src
CMD ["pnpm", "worker"]
