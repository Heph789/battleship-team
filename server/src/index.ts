import express from "express";
import http from "node:http";
import cors from "cors";
import { createSocketServer } from "./socket/index.js";
import { ensureTables } from "./db/migrate.js";
import { getOrCreateUser } from "./auth/session.js";

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// REST endpoint: get or create session
// Token comes from Authorization header (localStorage on client)
app.get("/api/session", (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;
  const { userId, token: newToken } = getOrCreateUser(token);
  res.json({ userId, token: newToken });
});

const server = http.createServer(app);
createSocketServer(server, CLIENT_ORIGIN);

ensureTables();

server.listen(PORT, () => {
  console.log(`Server listening on :${PORT}`);
});
