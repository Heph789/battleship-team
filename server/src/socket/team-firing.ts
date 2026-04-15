import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import {
  checkShot,
  checkWin,
  coordKey,
  getShipCells,
  type ServerGameState,
  type TeamId,
  type PlayerBoard,
  type ShipPlacement,
  type TeamGameState,
  type TeamShotResult,
} from "@battleship/shared";
import type { TypedServer, TypedSocket } from "./index.js";
import { db, schema, findGame } from "../db/index.js";
import {
  applyShot,
  getTeamForPlayer,
  getOpponentTeam,
  advanceTeamTurn,
  bothPlayersHaveFired,
  getPlayersNeedingShareDecision,
} from "../game/state.js";

export function registerTeamFiringHandlers(
  io: TypedServer,
  socket: TypedSocket,
) {
  const userId = socket.data.userId;

  socket.on("team_fire", (data: { x: number; y: number }) => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    const gameRow = findGame(gameId);
    if (!gameRow || gameRow.mode !== "team" || gameRow.status !== "in_progress") return;

    const state = gameRow.state as unknown as ServerGameState;
    const teamState = state.teamState;
    if (!teamState) return;

    const playerTeam = getTeamForPlayer(teamState, userId);
    if (playerTeam !== teamState.currentTeamTurn) {
      socket.emit("error", { message: "Not your team's turn" });
      return;
    }

    if (teamState.turnPhase !== "firing") {
      socket.emit("error", { message: "Not in firing phase" });
      return;
    }

    if (teamState.pendingShots[userId] != null) {
      socket.emit("error", { message: "Already fired this turn" });
      return;
    }

    teamState.pendingShots[userId] = { x: data.x, y: data.y };

    if (!bothPlayersHaveFired(teamState)) {
      // Waiting for teammate
      persistState(state, gameId);
      socket.emit("team_waiting_for_teammate");
      return;
    }

    // Both have fired — process shots
    const enemyTeam = getOpponentTeam(playerTeam);
    const playerIds = teamState.teams[playerTeam].playerIds;
    let anyHits = false;

    for (const pid of playerIds) {
      const shot = teamState.pendingShots[pid]!;
      const coord = { x: shot.x, y: shot.y };
      // Re-read the board each iteration — processShot mutates teamState.boards[enemyTeam]
      const shotResult = processShot(pid, coord, teamState.boards[enemyTeam], teamState, enemyTeam);
      teamState.pendingResults[pid] = shotResult;

      if (shotResult.result === "hit" || shotResult.result === "sunk") {
        teamState.players[pid].hitCount++;
        anyHits = true;
      }

      // Record move
      db.insert(schema.move)
        .values({
          id: crypto.randomUUID(),
          gameId,
          userId: pid,
          x: shot.x,
          y: shot.y,
          result: shotResult.result === "wasted" ? "hit" : shotResult.result,
        })
        .run();
    }

    // Send results to each player
    const playersNeedingShare = anyHits ? getPlayersNeedingShareDecision(teamState) : [];

    if (anyHits) {
      teamState.turnPhase = "sharing";
    }

    for (const pid of playerIds) {
      const result = teamState.pendingResults[pid]!;
      const needsShare = playersNeedingShare.includes(pid);
      const phase = needsShare ? "share_prompt" as const : "done" as const;
      const sockets = getSocketsForUser(io, gameId, pid);
      for (const s of sockets) {
        s.emit("team_shot_result", { ...result, phase });
      }
    }

    // Notify the player who fired first that teammate is done
    const firstFirer = playerIds.find((id) => id !== userId);
    if (firstFirer) {
      const firstFirerSockets = getSocketsForUser(io, gameId, firstFirer);
      for (const s of firstFirerSockets) {
        s.emit("team_teammate_shot_done");
      }
    }

    if (!anyHits) {
      // No hits, skip sharing — complete the round
      completeRound(io, state, teamState, gameId, playerTeam, enemyTeam);
    } else {
      persistState(state, gameId);
    }
  });

  socket.on("team_share_decision", (data: { share: boolean }) => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    const gameRow = findGame(gameId);
    if (!gameRow || gameRow.mode !== "team" || gameRow.status !== "in_progress") return;

    const state = gameRow.state as unknown as ServerGameState;
    const teamState = state.teamState;
    if (!teamState) return;

    if (teamState.turnPhase !== "sharing") {
      socket.emit("error", { message: "Not in sharing phase" });
      return;
    }

    const pendingResult = teamState.pendingResults[userId];
    if (!pendingResult || (pendingResult.result !== "hit" && pendingResult.result !== "sunk")) {
      socket.emit("error", { message: "No pending share decision" });
      return;
    }

    const playerTeam = getTeamForPlayer(teamState, userId);
    const teammateId = teamState.teams[playerTeam].playerIds.find((id) => id !== userId);

    if (data.share && teammateId) {
      // Update teammate's private view
      const teammateView = teamState.playerViews[teammateId];
      teammateView.hits = [...teammateView.hits, pendingResult.coordinate];
      if (pendingResult.sunkShip) {
        teammateView.ships = [...teammateView.ships, pendingResult.sunkShip];
      }

      // Notify teammate
      const teammateSockets = getSocketsForUser(io, gameId, teammateId);
      for (const s of teammateSockets) {
        s.emit("team_share_received", {
          coordinate: pendingResult.coordinate,
          result: pendingResult.result as "hit" | "sunk",
          shipType: pendingResult.shipType,
          sunkShip: pendingResult.sunkShip,
        });
      }
    }

    // Clear this player's pending result to mark decision as made
    teamState.pendingResults[userId] = null;

    // Check if all share decisions are in
    const remaining = getPlayersNeedingShareDecision(teamState);
    if (remaining.length === 0) {
      const enemyTeam = getOpponentTeam(playerTeam);
      completeRound(io, state, teamState, gameId, playerTeam, enemyTeam);
    } else {
      persistState(state, gameId);
    }
  });
}

function processShot(
  playerId: string,
  coord: { x: number; y: number },
  trueBoard: PlayerBoard,
  teamState: TeamGameState,
  enemyTeam: TeamId,
): TeamShotResult {
  const key = coordKey(coord);

  // Check if cell was already hit on the TRUE board
  const alreadyHit = trueBoard.hits.some((c) => coordKey(c) === key);
  if (alreadyHit) {
    // Check if the ship at this cell is already sunk
    const revealedSunkShip = findSunkShipAt(coord, trueBoard);
    return {
      coordinate: coord,
      result: "wasted",
      revealedSunkShip: revealedSunkShip ?? undefined,
    };
  }

  // Check if teammate is also shooting this same cell this turn
  const currentTeam = teamState.currentTeamTurn;
  const teammateId = teamState.teams[currentTeam].playerIds.find((id) => id !== playerId);
  if (teammateId) {
    const teammateShot = teamState.pendingShots[teammateId];
    if (teammateShot && teammateShot.x === coord.x && teammateShot.y === coord.y) {
      // Both shot the same cell — first processed wins, second is wasted.
      // Since we process in playerIds order, check if teammate already got processed
      const teammateResult = teamState.pendingResults[teammateId];
      if (teammateResult && teammateResult.result !== "wasted") {
        return {
          coordinate: coord,
          result: "wasted",
        };
      }
    }
  }

  // Normal shot
  const shotResult = checkShot(coord, trueBoard);
  teamState.boards[enemyTeam] = applyShot(trueBoard, coord, shotResult.result);

  return {
    coordinate: coord,
    result: shotResult.result,
    shipType: shotResult.shipType,
    sunkShip: shotResult.sunkShip,
  };
}

function findSunkShipAt(
  coord: { x: number; y: number },
  board: PlayerBoard,
): ShipPlacement | null {
  const key = coordKey(coord);
  for (const ship of board.ships) {
    const cells = getShipCells(ship);
    if (cells.some((c) => coordKey(c) === key)) {
      const hitSet = new Set(board.hits.map(coordKey));
      const allSunk = cells.every((c) => hitSet.has(coordKey(c)));
      if (allSunk) return ship;
    }
  }
  return null;
}

function completeRound(
  io: TypedServer,
  state: ServerGameState,
  teamState: TeamGameState,
  gameId: string,
  firingTeam: TeamId,
  enemyTeam: TeamId,
) {
  // Check win condition on TRUE board
  const enemyBoard = teamState.boards[enemyTeam];
  if (checkWin(enemyBoard)) {
    const hitCounts: Record<string, number> = {};
    for (const [id, player] of Object.entries(teamState.players)) {
      hitCounts[id] = player.hitCount;
    }

    const winningPlayerIds = teamState.teams[firingTeam].playerIds;
    const mvp = winningPlayerIds.reduce((best, id) =>
      hitCounts[id] > hitCounts[best] ? id : best,
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

    io.to(gameId).emit("team_game_over", {
      winningTeam: firingTeam,
      hitCounts,
      mvp,
    });
    return;
  }

  // Notify enemy team about hits on their board this round
  const enemyPlayerIds = teamState.teams[enemyTeam].playerIds;
  const firingPlayerIds = teamState.teams[firingTeam].playerIds;

  const hitsThisRound: { x: number; y: number }[] = [];
  const missesThisRound: { x: number; y: number }[] = [];
  const sunkShipsThisRound: ShipPlacement[] = [];

  for (const pid of firingPlayerIds) {
    const result = teamState.pendingResults[pid];
    if (!result) continue;
    if (result.result === "hit") {
      hitsThisRound.push(result.coordinate);
    } else if (result.result === "sunk") {
      hitsThisRound.push(result.coordinate);
      if (result.sunkShip) sunkShipsThisRound.push(result.sunkShip);
    } else if (result.result === "miss") {
      missesThisRound.push(result.coordinate);
    }
    // wasted shots don't show to enemy team
  }

  for (const pid of enemyPlayerIds) {
    const sockets = getSocketsForUser(io, gameId, pid);
    for (const s of sockets) {
      s.emit("team_opponent_turn_result", {
        hitsOnYourBoard: hitsThisRound,
        missesOnYourBoard: missesThisRound,
        sunkShips: sunkShipsThisRound,
      });
    }
  }

  // Advance turn
  state.teamState = advanceTeamTurn(teamState);
  const nextTeam = state.teamState.currentTeamTurn;

  persistState(state, gameId);

  io.to(gameId).emit("team_round_complete", { nextTeamTurn: nextTeam });
  io.to(gameId).emit("team_turn_start", { currentTeamTurn: nextTeam });
}

function persistState(state: ServerGameState, gameId: string) {
  db.update(schema.game)
    .set({
      state: state as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(schema.game.id, gameId))
    .run();
}

function getSocketsForUser(io: TypedServer, gameId: string, targetUserId: string) {
  const room = io.sockets.adapter.rooms.get(gameId);
  if (!room) return [];
  const results: TypedSocket[] = [];
  for (const socketId of room) {
    const s = io.sockets.sockets.get(socketId) as unknown as TypedSocket | undefined;
    if (s && s.data.userId === targetUserId) {
      results.push(s);
    }
  }
  return results;
}
