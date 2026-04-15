import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import {
  generateRandomPlacements,
  type ServerGameState,
} from "@battleship/shared";
import type { TypedServer, TypedSocket } from "./index.js";
import { db, schema, findGame } from "../db/index.js";
import { generateCode } from "../game/code.js";
import { createInitialState, setPlayerShips } from "../game/state.js";

const AI_USER_ID = "ai";

// Track rematch requests per game (in-memory, fine for single server)
const rematchRequests = new Map<string, Set<string>>();

export function registerRematchHandlers(io: TypedServer, socket: TypedSocket) {
  const userId = socket.data.userId;

  socket.on("rematch", (data: { gameId: string }) => {
    const gameRow = findGame(data.gameId);
    if (!gameRow || gameRow.status !== "completed") {
      socket.emit("error", { message: "Game not eligible for rematch" });
      return;
    }

    const isAI = gameRow.mode === "ai";

    // AI mode: create new game immediately
    if (isAI) {
      const newGameId = crypto.randomUUID();
      let state = createInitialState(userId, AI_USER_ID, true);
      const aiShips = generateRandomPlacements();
      state = setPlayerShips(state, AI_USER_ID, aiShips);

      db.insert(schema.game)
        .values({
          id: newGameId,
          code: null,
          mode: "ai",
          status: "placing_ships",
          user1Id: userId,
          user2Id: AI_USER_ID,
          state: state as unknown as Record<string, unknown>,
        })
        .run();

      socket.leave(data.gameId);
      socket.join(newGameId);
      socket.data.gameId = newGameId;
      socket.emit("rematch_created", { gameId: newGameId });
      return;
    }

    // Multiplayer: wait for both players to request
    if (!rematchRequests.has(data.gameId)) {
      rematchRequests.set(data.gameId, new Set());
    }
    const requests = rematchRequests.get(data.gameId)!;
    requests.add(userId);

    if (requests.size < 2) {
      socket.to(data.gameId).emit("rematch_requested");
      return;
    }

    // Both requested — create new game
    rematchRequests.delete(data.gameId);
    const newGameId = crypto.randomUUID();
    const code = generateCode();
    const opponent =
      gameRow.user1Id === userId ? gameRow.user2Id! : gameRow.user1Id;
    const state = createInitialState(userId, opponent, false);

    db.insert(schema.game)
      .values({
        id: newGameId,
        code,
        mode: "multiplayer",
        status: "placing_ships",
        user1Id: userId,
        user2Id: opponent,
        state: state as unknown as Record<string, unknown>,
      })
      .run();

    io.to(data.gameId).emit("rematch_created", { gameId: newGameId });
    const sockets = io.sockets.adapter.rooms.get(data.gameId);
    if (sockets) {
      for (const sid of sockets) {
        const s = io.sockets.sockets.get(sid);
        if (s) {
          s.leave(data.gameId);
          s.join(newGameId);
          (s as unknown as TypedSocket).data.gameId = newGameId;
        }
      }
    }
  });
}
