import express from "express";
import http from "node:http";
import cookieParser from "cookie-parser";
import cors from "cors";
import { createSocketServer } from "./socket/index.js";
import { ensureTables } from "./db/migrate.js";
import { getOrCreateUser } from "./auth/session.js";

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// REST endpoint: create session cookie if none exists
app.get("/api/session", (req, res) => {
  const token = req.cookies?.session;
  const { userId, token: newToken } = getOrCreateUser(token);
  if (newToken !== token) {
    res.cookie("session", newToken, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
  }
  res.json({ userId, token: newToken });
});

const server = http.createServer(app);
createSocketServer(server, CLIENT_ORIGIN);

ensureTables();

server.listen(PORT, () => {
  console.log(`Server listening on :${PORT}`);
});
