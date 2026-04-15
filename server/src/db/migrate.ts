import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const DB_PATH = process.env.DB_PATH ?? "./data/battleship.db";

export function ensureTables() {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "user" (
      "id" text PRIMARY KEY NOT NULL,
      "display_name" text NOT NULL,
      "session_token" text NOT NULL,
      "created_at" integer NOT NULL DEFAULT (unixepoch())
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "user_session_token_unique" ON "user" ("session_token");

    CREATE TABLE IF NOT EXISTS "game" (
      "id" text PRIMARY KEY NOT NULL,
      "code" text,
      "mode" text NOT NULL,
      "status" text NOT NULL,
      "user1_id" text NOT NULL REFERENCES "user"("id"),
      "user2_id" text REFERENCES "user"("id"),
      "winner_id" text REFERENCES "user"("id"),
      "state" text,
      "created_at" integer NOT NULL DEFAULT (unixepoch()),
      "updated_at" integer NOT NULL DEFAULT (unixepoch())
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "game_code_unique" ON "game" ("code");

    -- Sentinel row for the AI opponent
    INSERT OR IGNORE INTO "user" ("id", "display_name", "session_token")
      VALUES ('ai', 'AI', 'ai-no-login');

    CREATE TABLE IF NOT EXISTS "move" (
      "id" text PRIMARY KEY NOT NULL,
      "game_id" text NOT NULL REFERENCES "game"("id"),
      "user_id" text NOT NULL REFERENCES "user"("id"),
      "x" integer NOT NULL,
      "y" integer NOT NULL,
      "result" text NOT NULL,
      "created_at" integer NOT NULL DEFAULT (unixepoch())
    );
  `);

  sqlite.close();
}
