# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm \
  && pnpm install --frozen-lockfile

COPY . .
RUN pnpm prisma:generate \
  && pnpm build

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY package.json ./

CMD ["node", "dist/src/main"]
