import { eq } from "drizzle-orm";
import {
  type ServerGameState,
  type ShipPlacement,
  type ShipType,
  type TeamGameState,
  validatePlacement,
  SHIP_TYPES,
} from "@battleship/shared";
import type { TypedServer, TypedSocket } from "./index.js";
import { db, schema, findGame } from "../db/index.js";
import {
  getTeamForPlayer,
  allTeamPlayersLockedIn,
  getCurrentTurnUserId,
} from "../game/state.js";

export function registerTeamPlacementHandlers(
  io: TypedServer,
  socket: TypedSocket,
) {
  const userId = socket.data.userId;

  socket.on("team_place_ship", (data: { ship: ShipPlacement }) => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    const gameRow = findGame(gameId);
    if (!gameRow || gameRow.mode !== "team" || gameRow.status !== "placing_ships") return;

    const state = gameRow.state as unknown as ServerGameState;
    const teamState = state.teamState;
    if (!teamState) return;

    const teamId = getTeamForPlayer(teamState, userId);
    const currentShips = teamState.placementShips[teamId];

    // Remove existing ship of same type, then validate new placement
    const others = currentShips.filter((s) => s.type !== data.ship.type);
    if (!validatePlacement(data.ship, others)) {
      socket.emit("error", { message: "Invalid ship placement" });
      return;
    }

    // Update placement
    teamState.placementShips[teamId] = [...others, data.ship];

    db.update(schema.game)
      .set({
        state: state as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(schema.game.id, gameId))
      .run();

    // Notify teammate only
    const teammateId = teamState.teams[teamId].playerIds.find(
      (id) => id !== userId,
    );
    if (teammateId) {
      // Emit to all sockets in the room except sender, but only teammate should care
      // We need to find teammate's socket. Broadcast to room and let client filter,
      // or use per-socket emit. For simplicity, broadcast to room — only teammate
      // is on the same team and will process this event.
      const teammates = getSocketsForUser(io, gameId, teammateId);
      for (const s of teammates) {
        s.emit("teammate_placed_ship", { ship: data.ship });
      }
    }
  });

  socket.on("team_remove_ship", (data: { shipType: ShipType }) => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    const gameRow = findGame(gameId);
    if (!gameRow || gameRow.mode !== "team" || gameRow.status !== "placing_ships") return;

    const state = gameRow.state as unknown as ServerGameState;
    const teamState = state.teamState;
    if (!teamState) return;

    const teamId = getTeamForPlayer(teamState, userId);

    // Check if player is locked in — can't modify after lock-in
    if (teamState.players[userId].ready) {
      socket.emit("error", { message: "Already locked in" });
      return;
    }

    teamState.placementShips[teamId] = teamState.placementShips[teamId].filter(
      (s) => s.type !== data.shipType,
    );

    db.update(schema.game)
      .set({
        state: state as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(schema.game.id, gameId))
      .run();

    const teammateId = teamState.teams[teamId].playerIds.find(
      (id) => id !== userId,
    );
    if (teammateId) {
      const teammates = getSocketsForUser(io, gameId, teammateId);
      for (const s of teammates) {
        s.emit("teammate_removed_ship", { shipType: data.shipType });
      }
    }
  });

  socket.on("team_lock_in", () => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    const gameRow = findGame(gameId);
    if (!gameRow || gameRow.mode !== "team" || gameRow.status !== "placing_ships") return;

    const state = gameRow.state as unknown as ServerGameState;
    const teamState = state.teamState;
    if (!teamState) return;

    const teamId = getTeamForPlayer(teamState, userId);

    // Validate that the team has all 5 ships placed
    const teamShips = teamState.placementShips[teamId];
    const placedTypes = new Set(teamShips.map((s) => s.type));
    const allPlaced = SHIP_TYPES.every((t) => placedTypes.has(t));
    if (!allPlaced) {
      socket.emit("error", { message: "All ships must be placed before locking in" });
      return;
    }

    teamState.players[userId].ready = true;

    // Notify teammate
    const teammateId = teamState.teams[teamId].playerIds.find(
      (id) => id !== userId,
    );
    if (teammateId) {
      const teammates = getSocketsForUser(io, gameId, teammateId);
      for (const s of teammates) {
        s.emit("teammate_locked_in");
      }
    }

    if (allTeamPlayersLockedIn(teamState)) {
      // Copy placement ships into boards
      teamState.boards.teamA = {
        ships: teamState.placementShips.teamA,
        hits: [],
        misses: [],
      };
      teamState.boards.teamB = {
        ships: teamState.placementShips.teamB,
        hits: [],
        misses: [],
      };

      state.currentTurn = getCurrentTurnUserId(teamState);

      db.update(schema.game)
        .set({
          status: "in_progress",
          state: state as unknown as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(schema.game.id, gameId))
        .run();

      // Emit to each player individually with their private point values
      const allPlayerIds = [
        ...teamState.teams.teamA.playerIds,
        ...teamState.teams.teamB.playerIds,
      ];
      for (const playerId of allPlayerIds) {
        const sockets = getSocketsForUser(io, gameId, playerId);
        for (const s of sockets) {
          s.emit("team_both_ready", {
            currentTurn: state.currentTurn,
            turnOrder: teamState.turnOrder,
            yourPointValues: teamState.players[playerId].pointValues,
          });
        }
      }
    } else {
      db.update(schema.game)
        .set({
          state: state as unknown as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(schema.game.id, gameId))
        .run();
    }
  });
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
