import type {
  ServerGameState,
  ShipPlacement,
  PlayerBoard,
  TeamGameState,
  TeamId,
} from "@battleship/shared";
import { initAI, generatePointValues } from "@battleship/shared";

export function createInitialState(
  user1Id: string,
  user2Id: string | null,
  isAI: boolean,
): ServerGameState {
  const state: ServerGameState = {
    players: {
      [user1Id]: { ships: [], ready: false },
    },
    boards: {
      [user1Id]: { ships: [], hits: [], misses: [] },
    },
    currentTurn: user1Id,
    aiState: isAI ? initAI() : null,
    teamState: null,
  };

  if (user2Id) {
    state.players[user2Id] = { ships: [], ready: false };
    state.boards[user2Id] = { ships: [], hits: [], misses: [] };
  }

  return state;
}

export function setPlayerShips(
  state: ServerGameState,
  userId: string,
  ships: ShipPlacement[],
): ServerGameState {
  return {
    ...state,
    players: {
      ...state.players,
      [userId]: { ships, ready: true },
    },
    boards: {
      ...state.boards,
      [userId]: { ...state.boards[userId], ships },
    },
  };
}

export function allPlayersReady(state: ServerGameState): boolean {
  return Object.values(state.players).every((p) => p.ready);
}

export function getOpponentId(
  state: ServerGameState,
  userId: string,
): string | undefined {
  return Object.keys(state.players).find((id) => id !== userId);
}

export function applyShot(
  board: PlayerBoard,
  coord: { x: number; y: number },
  result: "hit" | "miss" | "sunk",
): PlayerBoard {
  if (result === "miss") {
    return { ...board, misses: [...board.misses, coord] };
  }
  return { ...board, hits: [...board.hits, coord] };
}

// --- Team mode functions ---

export function createTeamInitialState(
  teamA: [string, string],
  teamB: [string, string],
): TeamGameState {
  const allPlayers = [...teamA, ...teamB];
  const players: TeamGameState["players"] = {};
  for (const id of allPlayers) {
    players[id] = {
      ready: false,
      pointValues: generatePointValues(),
      score: 0,
    };
  }

  return {
    teams: {
      teamA: { playerIds: [...teamA] },
      teamB: { playerIds: [...teamB] },
    },
    boards: {
      teamA: { ships: [], hits: [], misses: [] },
      teamB: { ships: [], hits: [], misses: [] },
    },
    players,
    placementShips: { teamA: [], teamB: [] },
    turnOrder: [teamA[0], teamB[0], teamA[1], teamB[1]],
    currentTurnIndex: 0,
  };
}

export function getTeamForPlayer(
  teamState: TeamGameState,
  userId: string,
): TeamId {
  if (teamState.teams.teamA.playerIds.includes(userId)) return "teamA";
  return "teamB";
}

export function getOpponentTeam(teamId: TeamId): TeamId {
  return teamId === "teamA" ? "teamB" : "teamA";
}

export function advanceTurn(teamState: TeamGameState): TeamGameState {
  return {
    ...teamState,
    currentTurnIndex:
      (teamState.currentTurnIndex + 1) % teamState.turnOrder.length,
  };
}

export function getCurrentTurnUserId(teamState: TeamGameState): string {
  return teamState.turnOrder[teamState.currentTurnIndex];
}

export function allTeamPlayersLockedIn(teamState: TeamGameState): boolean {
  return Object.values(teamState.players).every((p) => p.ready);
}
