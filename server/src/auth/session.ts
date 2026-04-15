import crypto from "node:crypto";
import { db, schema, findUserByToken } from "../db/index.js";

export function generateToken(): string {
  return crypto.randomUUID();
}

export function getOrCreateUser(sessionToken: string | undefined): {
  userId: string;
  token: string;
} {
  if (sessionToken) {
    const existing = findUserByToken(sessionToken);
    if (existing) {
      return { userId: existing.id, token: sessionToken };
    }
  }

  const id = crypto.randomUUID();
  const token = generateToken();
  db.insert(schema.user)
    .values({
      id,
      displayName: `Player-${id.slice(0, 4)}`,
      sessionToken: token,
    })
    .run();
  return { userId: id, token };
}

export function getUserByToken(token: string) {
  return findUserByToken(token);
}
