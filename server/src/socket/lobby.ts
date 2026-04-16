import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import {
  generateRandomPlacements,
  type GameMode,
  type ServerGameState,
} from "@battleship/shared";
import type { TypedServer, TypedSocket } from "./index.js";
import { db, schema, findGame, findGameByCode } from "../db/index.js";
import { generateCode } from "../game/code.js";
import {
  createInitialState,
  setPlayerShips,
  getTeamForPlayer,
  getOpponentTeam,
} from "../game/state.js";
import { createTeamLobby, getTeamLobby } from "./team-lobby.js";

const AI_USER_ID = "ai";

export function registerLobbyHandlers(io: TypedServer, socket: TypedSocket) {
  const userId = socket.data.userId;

  socket.on("create_game", (data: { mode: GameMode }) => {
    const { mode } = data;
    const gameId = crypto.randomUUID();
    const isAI = mode === "ai";
    const isTeam = mode === "team";
    const code = isAI ? null : generateCode();

    if (isTeam) {
      // Team mode: create a waiting game and register the team lobby
      db.insert(schema.game)
        .values({
          id: gameId,
          code,
          mode,
          status: "waiting",
          user1Id: userId,
          state: {} as Record<string, unknown>,
        })
        .run();

      createTeamLobby(gameId, userId);
      socket.join(gameId);
      socket.data.gameId = gameId;
      socket.emit("game_created", { gameId, code });
      return;
    }

    let state = createInitialState(userId, isAI ? AI_USER_ID : null, isAI);

    if (isAI) {
      const aiShips = generateRandomPlacements();
      state = setPlayerShips(state, AI_USER_ID, aiShips);
    }

    db.insert(schema.game)
      .values({
        id: gameId,
        code,
        mode,
        status: isAI ? "placing_ships" : "waiting",
        user1Id: userId,
        user2Id: isAI ? AI_USER_ID : null,
        state: state as unknown as Record<string, unknown>,
      })
      .run();

    socket.join(gameId);
    socket.data.gameId = gameId;
    socket.emit("game_created", { gameId, code });
  });

  socket.on("join_game", (data: { code: string }) => {
    const gameRow = findGameByCode(data.code);
    if (!gameRow) {
      socket.emit("error", { message: "Game not found" });
      return;
    }
    if (gameRow.status !== "waiting") {
      socket.emit("error", { message: "Game already started" });
      return;
    }
    if (gameRow.user1Id === userId) {
      socket.emit("error", { message: "Cannot join your own game" });
      return;
    }

    let state = gameRow.state as unknown as ServerGameState;
    state = {
      ...state,
      players: {
        ...state.players,
        [userId]: { ships: [], ready: false },
      },
      boards: {
        ...state.boards,
        [userId]: { ships: [], hits: [], misses: [] },
      },
    };

    db.update(schema.game)
      .set({
        user2Id: userId,
        status: "placing_ships",
        state: state as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(schema.game.id, gameRow.id))
      .run();

    socket.join(gameRow.id);
    socket.data.gameId = gameRow.id;
    socket.emit("game_joined", { gameId: gameRow.id });
    socket.to(gameRow.id).emit("opponent_joined");
  });

  socket.on("leave_game", () => {
    const gid = socket.data.gameId;
    if (gid) {
      socket.leave(gid);
      socket.data.gameId = undefined;
    }
  });

  socket.on("reconnect_game", (data: { gameId: string }) => {
    const gameRow = findGame(data.gameId);
    if (!gameRow) {
      socket.emit("error", { message: "Game not found" });
      return;
    }

    const playerIds = [gameRow.user1Id, gameRow.user2Id, gameRow.user3Id, gameRow.user4Id];
    if (!playerIds.includes(userId)) {
      socket.emit("error", { message: "Not a participant" });
      return;
    }

    socket.join(data.gameId);
    socket.data.gameId = data.gameId;

    const state = gameRow.state as unknown as ServerGameState;

    // Team mode reconnect
    if (gameRow.mode === "team") {
      // Lobby phase — re-emit lobby state from in-memory lobby
      if (gameRow.status === "waiting") {
        const lobbyUpdate = getTeamLobby(data.gameId);
        if (lobbyUpdate) {
          socket.emit("game_created", { gameId: data.gameId, code: gameRow.code });
          socket.emit("team_lobby_update", lobbyUpdate);
        }
        return;
      }

      const teamState = state.teamState!;
      const teamId = getTeamForPlayer(teamState, userId);
      const enemyTeam = getOpponentTeam(teamId);
      const teammateId = teamState.teams[teamId].playerIds.find((id) => id !== userId);

      const lookupDisplayName = (id: string) => {
        const user = db.select().from(schema.user).where(eq(schema.user.id, id)).get();
        return user?.displayName ?? "Unknown";
      };

      const teams = {
        teamA: {
          playerIds: teamState.teams.teamA.playerIds,
          displayNames: teamState.teams.teamA.playerIds.map(lookupDisplayName),
        },
        teamB: {
          playerIds: teamState.teams.teamB.playerIds,
          displayNames: teamState.teams.teamB.playerIds.map(lookupDisplayName),
        },
      };

      const isMyTeamsTurn = teamState.currentTeamTurn === teamId;
      const hasFired = teamState.pendingShots[userId] != null;

      socket.emit("reconnect_state", {
        gameId: data.gameId,
        mode: "team",
        status: gameRow.status as any,
        yourShips: [],
        yourBoard: { ships: [], hits: [], misses: [] },
        opponentBoard: { ships: [], hits: [], misses: [] },
        currentTurn: "",
        winnerId: gameRow.winnerId,
        isYourTurn: isMyTeamsTurn,
        teamId,
        teams,
        teamBoard: teamState.boards[teamId],
        myEnemyView: teamState.playerViews[userId],
        hitCount: teamState.players[userId].hitCount,
        currentTeamTurn: teamState.currentTeamTurn,
        turnPhase: teamState.turnPhase,
        teammateReady: teammateId ? teamState.players[teammateId].ready : false,
        placementShips: teamState.placementShips[teamId],
      });
      return;
    }

    // 1v1 / AI reconnect
    const opponentId =
      gameRow.user1Id === userId ? gameRow.user2Id! : gameRow.user1Id;

    socket.emit("reconnect_state", {
      gameId: data.gameId,
      mode: gameRow.mode as any,
      status: gameRow.status as any,
      yourShips: state.players[userId]?.ships ?? [],
      yourBoard: state.boards[userId] ?? { ships: [], hits: [], misses: [] },
      opponentBoard: {
        ships: [], // never reveal opponent ships
        hits: state.boards[opponentId]?.hits ?? [],
        misses: state.boards[opponentId]?.misses ?? [],
      },
      currentTurn: state.currentTurn,
      winnerId: gameRow.winnerId,
      isYourTurn: state.currentTurn === userId,
    });
  });
}
