# Deployment Plan

**Client** → Vercel (Next.js)  
**Server** → Railway (Express + Socket.IO + SQLite)

---

## Overview

This is a pnpm monorepo with three packages:
- `client` — Next.js 16 frontend
- `server` — Express + Socket.IO backend with SQLite (`better-sqlite3`)
- `shared` — shared TypeScript types (workspace dependency)

---

## 1. Railway (Server)

Railway runs the Express server and hosts the SQLite database file on a persistent volume.

### Steps

1. Create a new Railway project and add a service from your GitHub repo (`battleship-team`).
2. Set the **root directory** to `server` (or configure a monorepo build — see below).
3. Add a **persistent volume** mounted at `/app/data` so the SQLite file survives redeploys.
4. Set environment variables (see below).
5. Railway will detect Node and use the `build` + `start` scripts.

### Build & Start Commands

```
Build:  pnpm install --frozen-lockfile && pnpm --filter @battleship/shared build && pnpm --filter @battleship/server build
Start:  node dist/index.js
```

> Railway needs to build `shared` first since `server` depends on it as a workspace package.
> If Railway doesn't support monorepo root builds, add a `Dockerfile` (see below).

### Environment Variables

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3001` (Railway sets this automatically — can omit) |
| `CLIENT_ORIGIN` | Your Vercel deployment URL, e.g. `https://battleship-team.vercel.app` |
| `DB_PATH` | `/app/data/battleship.db` (update `migrate.ts` to read from env if needed) |

### Persistent Volume

- Mount path: `/app/data`
- This keeps `battleship.db` across deployments. Without it, the database resets on every deploy.

### Dockerfile (recommended for monorepo)

If Railway struggles with the monorepo workspace setup, add a `Dockerfile` at the repo root:

```dockerfile
FROM node:20-slim AS builder
RUN npm install -g pnpm
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/ shared/
COPY server/ server/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @battleship/shared build
RUN pnpm --filter @battleship/server build

FROM node:20-slim
RUN npm install -g pnpm
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package.json ./server/package.json
WORKDIR /app/server
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

---

## 2. Vercel (Client)

Vercel has native Next.js support and handles the client with no extra configuration.

### Steps

1. Import the `battleship-team` repo in Vercel.
2. Set the **root directory** to `client`.
3. Vercel will auto-detect Next.js and use `next build` / `next start`.
4. Set environment variables (see below).
5. Deploy.

### Environment Variables

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SERVER_URL` | Your Railway service URL, e.g. `https://battleship-team-server.up.railway.app` |

> The client currently reads the server URL via the socket connection setup. Make sure the socket client and `/api/session` fetch both reference `process.env.NEXT_PUBLIC_SERVER_URL` rather than a hardcoded localhost URL.

### Build Command (auto-detected)

```
next build
```

---

## 3. Wiring Client → Server

After both services are deployed:

1. Copy the Railway public URL (e.g. `https://battleship-team-server.up.railway.app`)
2. Set it as `NEXT_PUBLIC_SERVER_URL` in Vercel environment variables
3. Set `CLIENT_ORIGIN` in Railway to the Vercel deployment URL
4. Redeploy both services

The server's CORS config reads `CLIENT_ORIGIN` at startup, so the order matters: deploy Railway first, then Vercel with the Railway URL.

---

## 4. Known Issues to Resolve Before Deploying

- **SQLite on Railway**: SQLite is single-process and fine for low traffic, but the DB path is currently hardcoded to `./data/battleship.db` in `server/src/db/migrate.ts`. Update it to read from `process.env.DB_PATH` so the Railway volume path can be injected.
- **Socket.IO sticky sessions**: If Railway ever scales to multiple instances, Socket.IO requires sticky sessions or a Redis adapter. Not needed for initial deploy.
- **`shared` build**: The `shared` package must be compiled before `server`. Verify `shared/tsconfig.json` outputs to `dist/` and `server`'s imports resolve correctly in production (check `package.json` `exports` field in `shared`).
- **`NEXT_PUBLIC_SERVER_URL`**: Audit client code to ensure all server references use this env var rather than `localhost:3001`.
