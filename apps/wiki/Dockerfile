# ==============================================================================
# Base Stage - Dependencies
# ==============================================================================

FROM node:lts-alpine AS base

WORKDIR /app

COPY apps/wiki/package*.json ./apps/wiki/

# ==============================================================================
# Development Stage
# ==============================================================================

FROM base AS dev

RUN apk add --no-cache tree openssh-client bash && rm -rf /var/cache/apk/*

RUN cd apps/wiki && npm install --no-audit --no-fund

COPY apps/wiki ./apps/wiki
WORKDIR /app/apps/wiki

EXPOSE 3000

CMD ["npm", "run", "watch"]

# ==============================================================================
# Builder Stage
# ==============================================================================

FROM base AS builder

RUN cd apps/wiki && npm install --no-audit --no-fund

COPY apps/wiki ./apps/wiki
WORKDIR /app/apps/wiki

RUN npm run build

# ==============================================================================
# Production Stage
# ==============================================================================

FROM node:lts-alpine AS production

WORKDIR /app
COPY apps/wiki/package*.json ./

RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --from=builder /app/apps/wiki/dist ./dist

RUN addgroup -g 1001 -S nodejs && \
	adduser -S nodejs -u 1001

RUN chown -R nodejs:nodejs /app

USER nodejs
EXPOSE 3000

CMD ["node", "dist/main.js"]
