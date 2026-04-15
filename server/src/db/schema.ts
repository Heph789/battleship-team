import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  sessionToken: text("session_token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const game = sqliteTable("game", {
  id: text("id").primaryKey(),
  code: text("code").unique(),
  mode: text("mode", { enum: ["ai", "multiplayer", "team"] }).notNull(),
  status: text("status", {
    enum: ["waiting", "placing_ships", "in_progress", "completed", "abandoned"],
  }).notNull(),
  user1Id: text("user1_id")
    .notNull()
    .references(() => user.id),
  user2Id: text("user2_id").references(() => user.id),
  user3Id: text("user3_id").references(() => user.id),
  user4Id: text("user4_id").references(() => user.id),
  winnerId: text("winner_id").references(() => user.id),
  state: text("state", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const move = sqliteTable("move", {
  id: text("id").primaryKey(),
  gameId: text("game_id")
    .notNull()
    .references(() => game.id),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  x: integer("x").notNull(),
  y: integer("y").notNull(),
  result: text("result", { enum: ["hit", "miss", "sunk"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
