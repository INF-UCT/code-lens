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

RUN cd apps/wiki && npm ci

COPY apps/wiki ./apps/wiki
WORKDIR /app/apps/wiki

EXPOSE 3000

CMD ["npm", "run", "watch"]

# ==============================================================================
# Builder Stage
# ==============================================================================

FROM base AS builder

RUN cd apps/wiki && npm ci

COPY apps/wiki ./apps/wiki
WORKDIR /app/apps/wiki

RUN npm run build

# ==============================================================================
# Production Stage
# ==============================================================================

FROM node:lts-alpine AS production

WORKDIR /app
COPY apps/wiki/package*.json ./

RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/apps/wiki/dist ./dist

RUN addgroup -g 1001 -S nodejs && \
	adduser -S nodejs -u 1001

RUN chown -R nodejs:nodejs /app

USER nodejs
EXPOSE 3000

CMD ["node", "dist/main.js"]
