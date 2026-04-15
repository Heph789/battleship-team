import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema.js";

const DB_PATH = process.env.DB_PATH ?? "./data/battleship.db";
mkdirSync(dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { schema };

// Helper: typed findFirst that returns T | undefined (not a query builder)
export function findGame(gameId: string) {
  return db.select().from(schema.game).where(eq(schema.game.id, gameId)).get();
}

export function findGameByCode(code: string) {
  return db
    .select()
    .from(schema.game)
    .where(eq(schema.game.code, code.toUpperCase()))
    .get();
}

export function findUserByToken(token: string) {
  return db
    .select()
    .from(schema.user)
    .where(eq(schema.user.sessionToken, token))
    .get();
}
