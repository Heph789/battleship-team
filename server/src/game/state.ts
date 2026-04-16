import type {
  ServerGameState,
  ShipPlacement,
  PlayerBoard,
  TeamGameState,
  TeamId,
} from "@battleship/shared";
import { initAI } from "@battleship/shared";

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
  const playerViews: TeamGameState["playerViews"] = {};
  for (const id of allPlayers) {
    players[id] = {
      ready: false,
      hitCount: 0,
    };
    playerViews[id] = { ships: [], hits: [], misses: [] };
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
    playerViews,
    players,
    placementShips: { teamA: [], teamB: [] },
    currentTeamTurn: "teamA",
    turnPhase: "waiting",
    pendingShots: {},
    pendingResults: {},
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

export function advanceTeamTurn(teamState: TeamGameState): TeamGameState {
  const nextTeam: TeamId = teamState.currentTeamTurn === "teamA" ? "teamB" : "teamA";
  return {
    ...teamState,
    currentTeamTurn: nextTeam,
    turnPhase: "firing",
    pendingShots: {},
    pendingResults: {},
  };
}

export function bothPlayersHaveFired(teamState: TeamGameState): boolean {
  const currentTeam = teamState.currentTeamTurn;
  const playerIds = teamState.teams[currentTeam].playerIds;
  return playerIds.every((id) => teamState.pendingShots[id] != null);
}

export function getPlayersNeedingShareDecision(teamState: TeamGameState): string[] {
  return Object.entries(teamState.pendingResults)
    .filter(([_, result]) => result != null && (result.result === "hit" || result.result === "sunk"))
    .map(([id]) => id);
}

export function allTeamPlayersLockedIn(teamState: TeamGameState): boolean {
  return Object.values(teamState.players).every((p) => p.ready);
}
