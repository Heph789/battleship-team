import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import {
  checkShot,
  checkWin,
  isAlreadyShot,
  getShipCells,
  coordKey,
  type ServerGameState,
  type TeamId,
  type PlayerBoard,
  type ShipType,
  type ShotResult,
  type TeamGameState,
} from "@battleship/shared";
import type { TypedServer, TypedSocket } from "./index.js";
import { db, schema } from "../db/index.js";
import {
  applyShot,
  getTeamForPlayer,
  getOpponentTeam,
  advanceTurn,
  getCurrentTurnUserId,
} from "../game/state.js";

export function registerTeamFiringHandlers(
  _io: TypedServer,
  _socket: TypedSocket,
) {
  // Team firing is handled via the existing "fire" event in firing.ts,
  // which delegates to handleTeamFire when mode === "team".
  // No additional event registration needed here.
}

export function handleTeamFire(
  io: TypedServer,
  socket: TypedSocket,
  gameRow: { id: string; state: unknown },
  data: { x: number; y: number },
) {
  const userId = socket.data.userId;
  const gameId = gameRow.id;
  const { x, y } = data;

  const state = gameRow.state as unknown as ServerGameState;
  const teamState = state.teamState;
  if (!teamState) {
    socket.emit("error", { message: "Invalid team state" });
    return;
  }

  const currentTurnUser = getCurrentTurnUserId(teamState);
  if (currentTurnUser !== userId) {
    socket.emit("error", { message: "Not your turn" });
    return;
  }

  const firerTeam = getTeamForPlayer(teamState, userId);
  const targetTeam = getOpponentTeam(firerTeam);
  const targetBoard = teamState.boards[targetTeam];
  const coord = { x, y };

  if (isAlreadyShot(coord, targetBoard)) {
    socket.emit("error", { message: "Already shot there" });
    return;
  }

  const result = checkShot(coord, targetBoard);
  teamState.boards[targetTeam] = applyShot(targetBoard, coord, result.result);

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

  // Calculate scoring
  let pointsEarned = 0;
  if (result.result === "hit" || result.result === "sunk") {
    const shipType = result.result === "sunk" ? result.shipType : findHitShipType(coord, targetBoard);
    if (shipType) {
      pointsEarned = teamState.players[userId].pointValues[shipType];
      teamState.players[userId].score += pointsEarned;
    }
  }

  const teamWon = checkWin(teamState.boards[targetTeam]);

  if (teamWon) {
    const winningTeam = firerTeam;
    const scores: Record<string, number> = {};
    for (const [id, player] of Object.entries(teamState.players)) {
      scores[id] = player.score;
    }

    // MVP: highest scorer on winning team
    const winningPlayerIds = teamState.teams[winningTeam].playerIds;
    const mvp = winningPlayerIds.reduce((best, id) =>
      scores[id] > scores[best] ? id : best,
    );

    state.teamState = teamState;

    db.update(schema.game)
      .set({
        status: "completed",
        winnerId: mvp,
        state: state as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(schema.game.id, gameId))
      .run();

    // Emit fire result to each player with appropriate info
    emitTeamFireResult(io, gameId, teamState, userId, firerTeam, targetTeam, result, pointsEarned, true);

    io.to(gameId).emit("team_game_over", {
      winningTeam,
      scores,
      mvp,
    });
    return;
  }

  // Advance turn
  state.teamState = advanceTurn(teamState);
  const nextTurn = getCurrentTurnUserId(state.teamState);
  state.currentTurn = nextTurn;

  db.update(schema.game)
    .set({
      state: state as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(schema.game.id, gameId))
    .run();

  emitTeamFireResult(io, gameId, teamState, userId, firerTeam, targetTeam, result, pointsEarned, false);
  io.to(gameId).emit("team_turn_update", { currentTurn: nextTurn });
}

function emitTeamFireResult(
  io: TypedServer,
  gameId: string,
  teamState: TeamGameState,
  firerUserId: string,
  firerTeam: TeamId,
  targetTeam: TeamId,
  result: ShotResult,
  pointsEarned: number,
  gameOver: boolean,
) {
  const room = io.sockets.adapter.rooms.get(gameId);
  if (!room) return;

  for (const socketId of room) {
    const s = io.sockets.sockets.get(socketId) as unknown as TypedSocket | undefined;
    if (!s) continue;

    const playerId = s.data.userId;
    const playerTeam = getTeamForPlayer(teamState, playerId);

    const payload = {
      ...result,
      gameOver,
      firerUserId,
      firedAtTeam: targetTeam,
      // Only the firer sees their score update
      yourScore: playerId === firerUserId
        ? teamState.players[firerUserId].score
        : undefined,
    };

    s.emit("team_fire_result", payload);
  }
}

function findHitShipType(
  coord: { x: number; y: number },
  board: PlayerBoard,
): ShipType | undefined {
  const key = coordKey(coord);
  for (const ship of board.ships) {
    if (getShipCells(ship).some((c) => coordKey(c) === key)) {
      return ship.type;
    }
  }
  return undefined;
}
