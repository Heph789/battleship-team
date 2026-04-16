import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import type { ServerGameState } from "@battleship/shared";
import type { TypedServer, TypedSocket } from "./index.js";
import { db, schema, findGame, findGameByCode } from "../db/index.js";
import { generateCode } from "../game/code.js";
import { createTeamInitialState } from "../game/state.js";

// Track players waiting in team lobbies: gameId -> { teamA: string[], teamB: string[] }
const teamLobbies = new Map<
  string,
  { teamA: string[]; teamB: string[] }
>();

function getDisplayName(userId: string): string {
  const user = db
    .select()
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .get();
  return user?.displayName ?? "Unknown";
}

function buildLobbyUpdate(lobby: { teamA: string[]; teamB: string[] }) {
  return {
    teams: {
      teamA: {
        playerIds: lobby.teamA,
        displayNames: lobby.teamA.map(getDisplayName),
      },
      teamB: {
        playerIds: lobby.teamB,
        displayNames: lobby.teamB.map(getDisplayName),
      },
    },
    playerCount: lobby.teamA.length + lobby.teamB.length,
  };
}

export function registerTeamLobbyHandlers(
  io: TypedServer,
  socket: TypedSocket,
) {
  const userId = socket.data.userId;

  // Team game creation is handled via the existing create_game event in lobby.ts
  // when mode === "team". We handle only the team-specific join flow here.

  socket.on("join_team_game", (data: { code: string }) => {
    const gameRow = findGameByCode(data.code);
    if (!gameRow) {
      socket.emit("error", { message: "Game not found" });
      return;
    }
    if (gameRow.mode !== "team") {
      socket.emit("error", { message: "Not a team game" });
      return;
    }
    if (gameRow.status !== "waiting") {
      socket.emit("error", { message: "Game already started" });
      return;
    }

    const lobby = teamLobbies.get(gameRow.id);
    if (!lobby) {
      socket.emit("error", { message: "Lobby not found" });
      return;
    }

    const allPlayers = [...lobby.teamA, ...lobby.teamB];
    if (allPlayers.includes(userId)) {
      socket.emit("error", { message: "Already in this game" });
      return;
    }

    // Auto-assign: fill teamA first, then teamB
    if (lobby.teamA.length < 2) {
      lobby.teamA.push(userId);
    } else if (lobby.teamB.length < 2) {
      lobby.teamB.push(userId);
    } else {
      socket.emit("error", { message: "Game is full" });
      return;
    }

    socket.join(gameRow.id);
    socket.data.gameId = gameRow.id;

    const playerCount = lobby.teamA.length + lobby.teamB.length;

    if (playerCount < 4) {
      // Still waiting for more players
      socket.emit("game_joined", { gameId: gameRow.id });
      io.to(gameRow.id).emit("team_lobby_update", buildLobbyUpdate(lobby));
      return;
    }

    // All 4 players — initialize team game state
    const teamState = createTeamInitialState(
      lobby.teamA as [string, string],
      lobby.teamB as [string, string],
    );

    const state: ServerGameState = {
      players: {},
      boards: {},
      currentTurn: "",
      aiState: null,
      teamState,
    };

    db.update(schema.game)
      .set({
        user2Id: lobby.teamA[1],
        user3Id: lobby.teamB[0],
        user4Id: lobby.teamB[1],
        status: "placing_ships",
        state: state as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(schema.game.id, gameRow.id))
      .run();

    socket.emit("game_joined", { gameId: gameRow.id });
    io.to(gameRow.id).emit("team_lobby_update", buildLobbyUpdate(lobby));

    teamLobbies.delete(gameRow.id);
  });
}

// Called from lobby.ts when mode === "team"
export function createTeamLobby(gameId: string, creatorId: string) {
  teamLobbies.set(gameId, { teamA: [creatorId], teamB: [] });
}

export function getTeamLobby(gameId: string) {
  const lobby = teamLobbies.get(gameId);
  if (!lobby) return null;
  return buildLobbyUpdate(lobby);
}
