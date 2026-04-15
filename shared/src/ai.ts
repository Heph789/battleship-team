import {
  BOARD_SIZE,
  type AIState,
  type Coordinate,
  type PlayerBoard,
  type ShotResult,
} from "./types";
import { coordKey, checkShot, getShipCells } from "./logic";

export function initAI(): AIState {
  return {
    mode: "hunt",
    targetQueue: [],
    shotsTaken: [],
  };
}

function getAdjacentCells(coord: Coordinate): Coordinate[] {
  const dirs = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ];
  return dirs
    .map((d) => ({ x: coord.x + d.x, y: coord.y + d.y }))
    .filter(
      (c) => c.x >= 0 && c.x < BOARD_SIZE && c.y >= 0 && c.y < BOARD_SIZE,
    );
}

function pickRandomUnshot(shotsTaken: Set<string>): Coordinate {
  const available: Coordinate[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (!shotsTaken.has(`${x},${y}`)) {
        available.push({ x, y });
      }
    }
  }
  return available[Math.floor(Math.random() * available.length)];
}

export function aiTakeShot(
  aiState: AIState,
  playerBoard: PlayerBoard,
): { coord: Coordinate; result: ShotResult; newState: AIState } {
  const shotSet = new Set(aiState.shotsTaken);
  let coord: Coordinate;
  let currentQueue = [...aiState.targetQueue];
  let currentMode = aiState.mode;

  if (currentMode === "target" && currentQueue.length > 0) {
    let next: Coordinate | undefined;
    while (currentQueue.length > 0) {
      const candidate = currentQueue.shift()!;
      if (!shotSet.has(coordKey(candidate))) {
        next = candidate;
        break;
      }
    }
    if (next) {
      coord = next;
    } else {
      coord = pickRandomUnshot(shotSet);
      currentMode = "hunt";
      currentQueue = [];
    }
  } else {
    coord = pickRandomUnshot(shotSet);
    currentMode = "hunt";
    currentQueue = [];
  }

  const result = checkShot(coord, playerBoard);
  shotSet.add(coordKey(coord));

  let newMode = currentMode;
  let newQueue = [...currentQueue];

  if (result.result === "hit") {
    newMode = "target";
    const adjacent = getAdjacentCells(coord).filter(
      (c) => !shotSet.has(coordKey(c)),
    );
    newQueue.push(...adjacent);
  } else if (result.result === "sunk") {
    const sunkShip = playerBoard.ships.find((s) => s.type === result.shipType);
    if (sunkShip) {
      const sunkCells = new Set(getShipCells(sunkShip).map(coordKey));
      newQueue = newQueue.filter((c) => !sunkCells.has(coordKey(c)));
    }
    newMode = newQueue.length > 0 ? "target" : "hunt";
  }

  return {
    coord,
    result,
    newState: {
      mode: newMode,
      targetQueue: newQueue,
      shotsTaken: Array.from(shotSet),
    },
  };
}
