# syntax=docker.io/docker/dockerfile:1

# Stage 1: Dependencies
FROM oven/bun:1.3.9 AS deps
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Stage 2: Build
FROM oven/bun:1.3.9 AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Several modules construct DB/API clients at import time (drizzle/neon, redis,
# stripe, etc.), which throws on `undefined` -- so `bun run build` needs real
# env values, not just NEXT_PUBLIC_* ones. prod.env (written by CI from the
# ENV_FILE secret, see deploy.yml) is picked up here via COPY . . above and
# sourced safely (values aren't shell-reinterpreted) so build-time behavior
# matches Cloud Run runtime. SKIP_ENV_VALIDATION is a fallback for builds with
# no env file present at all (e.g. a quick local test build).
ARG SKIP_ENV_VALIDATION=1
ENV SKIP_ENV_VALIDATION=$SKIP_ENV_VALIDATION
RUN set -a; \
    if [ -f prod.env ]; then \
      tr -d '\r' < prod.env > prod.env.normalized && mv prod.env.normalized prod.env; \
      while IFS= read -r line || [ -n "$line" ]; do \
        case "$line" in ''|'#'*) continue ;; esac; \
        key="${line%%=*}"; \
        value="${line#*=}"; \
        export "$key=$value"; \
      done < prod.env; \
      rm -f prod.env; \
    fi; \
    bun run build

# Stage 3: Production
FROM oven/bun:1.3.9 AS runner
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
