# syntax=docker.io/docker/dockerfile:1

# Stage 1: Dependencies
FROM oven/bun:1 AS deps
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Stage 2: Build
FROM oven/bun:1 AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, so they
# must be supplied as build args (server-only secrets are injected at Cloud Run
# runtime instead, see the "runner" stage). SKIP_ENV_VALIDATION lets the build
# proceed without the full server secret set present in the build context.
ARG SKIP_ENV_VALIDATION=1
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_VAPI_PUBLIC_KEY
ARG NEXT_PUBLIC_VAPI_ASSISTANT_ID
ARG NEXT_PUBLIC_VOICE_BACKEND_URL
ENV SKIP_ENV_VALIDATION=$SKIP_ENV_VALIDATION \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_VAPI_PUBLIC_KEY=$NEXT_PUBLIC_VAPI_PUBLIC_KEY \
    NEXT_PUBLIC_VAPI_ASSISTANT_ID=$NEXT_PUBLIC_VAPI_ASSISTANT_ID \
    NEXT_PUBLIC_VOICE_BACKEND_URL=$NEXT_PUBLIC_VOICE_BACKEND_URL

RUN bun run build

# Stage 3: Production
FROM oven/bun:1 AS runner
LABEL org.opencontainers.image.name="core-lens.app"
WORKDIR /app

ENV NODE_ENV=production

RUN groupadd -g 1001 nodejs && \
    useradd -m -u 1001 -g nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["bun", "server.js"]
