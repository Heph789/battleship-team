import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import {
  generateRandomPlacements,
  type ServerGameState,
} from "@battleship/shared";
import type { TypedServer, TypedSocket } from "./index.js";
import { db, schema, findGame } from "../db/index.js";
import { generateCode } from "../game/code.js";
import { createInitialState, setPlayerShips, createTeamInitialState } from "../game/state.js";

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

    // Team mode: wait for all 4 players to request
    if (gameRow.mode === "team") {
      if (!rematchRequests.has(data.gameId)) {
        rematchRequests.set(data.gameId, new Set());
      }
      const requests = rematchRequests.get(data.gameId)!;
      requests.add(userId);

      if (requests.size < 4) {
        io.to(data.gameId).emit("rematch_requested", {
          acceptedCount: requests.size,
          requiredCount: 4,
        });
        return;
      }

      // All 4 requested — create new team game
      rematchRequests.delete(data.gameId);
      const newGameId = crypto.randomUUID();
      const teamA: [string, string] = [gameRow.user1Id, gameRow.user2Id!];
      const teamB: [string, string] = [gameRow.user3Id!, gameRow.user4Id!];
      const teamState = createTeamInitialState(teamA, teamB);

      const state: ServerGameState = {
        players: {},
        boards: {},
        currentTurn: "",
        aiState: null,
        teamState,
      };

      db.insert(schema.game)
        .values({
          id: newGameId,
          code: null,
          mode: "team",
          status: "placing_ships",
          user1Id: teamA[0],
          user2Id: teamA[1],
          user3Id: teamB[0],
          user4Id: teamB[1],
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
      return;
    }

    // Multiplayer: wait for both players to request
    if (!rematchRequests.has(data.gameId)) {
      rematchRequests.set(data.gameId, new Set());
    }
    const requests = rematchRequests.get(data.gameId)!;
    requests.add(userId);

    if (requests.size < 2) {
      io.to(data.gameId).emit("rematch_requested", {
        acceptedCount: 1,
        requiredCount: 2,
      });
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
