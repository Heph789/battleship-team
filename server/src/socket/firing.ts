import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import {
  checkShot,
  checkWin,
  isAlreadyShot,
  aiTakeShot,
  type ServerGameState,
} from "@battleship/shared";
import type { TypedServer, TypedSocket } from "./index.js";
import { db, schema, findGame } from "../db/index.js";
import { applyShot, getOpponentId } from "../game/state.js";
import { handleTeamFire } from "./team-firing.js";

const AI_USER_ID = "ai";

export function registerFiringHandlers(io: TypedServer, socket: TypedSocket) {
  const userId = socket.data.userId;

  socket.on("fire", (data: { x: number; y: number }) => {
    const { x, y } = data;
    const gameId = socket.data.gameId;
    if (!gameId) {
      socket.emit("error", { message: "Not in a game" });
      return;
    }

    const gameRow = findGame(gameId);
    if (!gameRow || gameRow.status !== "in_progress") {
      socket.emit("error", { message: "Game not in progress" });
      return;
    }

    if (gameRow.mode === "team") {
      handleTeamFire(io, socket, gameRow, data);
      return;
    }

    const state = gameRow.state as unknown as ServerGameState;

    if (state.currentTurn !== userId) {
      socket.emit("error", { message: "Not your turn" });
      return;
    }

    const opponentId = getOpponentId(state, userId);
    if (!opponentId) {
      socket.emit("error", { message: "No opponent" });
      return;
    }

    const opponentBoard = state.boards[opponentId];
    const coord = { x, y };

    if (isAlreadyShot(coord, opponentBoard)) {
      socket.emit("error", { message: "Already shot there" });
      return;
    }

    // Process player's shot
    const result = checkShot(coord, opponentBoard);
    state.boards[opponentId] = applyShot(opponentBoard, coord, result.result);

    // Record move
    db.insert(schema.move)
      .values({
        id: crypto.randomUUID(),
        gameId,
        userId,
        x,
        y,
        result: result.result,
      })
      .run();

    const playerWon = checkWin(state.boards[opponentId]);

    if (playerWon) {
      db.update(schema.game)
        .set({
          status: "completed",
          winnerId: userId,
          state: state as unknown as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(schema.game.id, gameId))
        .run();

      socket.emit("fire_result", { ...result, gameOver: true });
      socket.to(gameId).emit("opponent_fired", { ...result, gameOver: true });
      io.to(gameId).emit("game_over", { winnerId: userId });
      return;
    }

    // Switch turn
    state.currentTurn = opponentId;

    socket.emit("fire_result", { ...result, gameOver: false });
    socket.to(gameId).emit("opponent_fired", { ...result, gameOver: false });

    // AI mode: AI fires back immediately
    if (opponentId === AI_USER_ID && state.aiState) {
      const playerBoard = state.boards[userId];
      const aiResult = aiTakeShot(state.aiState, playerBoard);

      state.boards[userId] = applyShot(
        playerBoard,
        aiResult.coord,
        aiResult.result.result,
      );
      state.aiState = aiResult.newState;

      // Record AI move
      db.insert(schema.move)
        .values({
          id: crypto.randomUUID(),
          gameId,
          userId: AI_USER_ID,
          x: aiResult.coord.x,
          y: aiResult.coord.y,
          result: aiResult.result.result,
        })
        .run();

      const aiWon = checkWin(state.boards[userId]);

      if (aiWon) {
        db.update(schema.game)
          .set({
            status: "completed",
            winnerId: AI_USER_ID,
            state: state as unknown as Record<string, unknown>,
            updatedAt: new Date(),
          })
          .where(eq(schema.game.id, gameId))
          .run();

        socket.emit("opponent_fired", { ...aiResult.result, gameOver: true });
        io.to(gameId).emit("game_over", { winnerId: AI_USER_ID });
        return;
      }

      // Switch turn back to player
      state.currentTurn = userId;
      socket.emit("opponent_fired", { ...aiResult.result, gameOver: false });
    }

    // Save state
    db.update(schema.game)
      .set({
        state: state as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(schema.game.id, gameId))
      .run();
  });
}
