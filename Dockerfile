FROM node:20-slim

RUN npm install -g pnpm

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/ shared/
COPY server/ server/

RUN pnpm install --frozen-lockfile

WORKDIR /app/server

ENV NODE_ENV=production
EXPOSE 3001

CMD ["npx", "tsx", "src/index.ts"]
