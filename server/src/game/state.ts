import type { ServerGameState, ShipPlacement, PlayerBoard } from "@battleship/shared";
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
