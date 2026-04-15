import {
  BOARD_SIZE,
  type Coordinate,
  type PlayerBoard,
  type ShotResult,
  coordKey,
  checkShot,
  getShipCells,
} from "@battleship/shared";

export type AIMode = "hunt" | "target";

export type AIState = {
  mode: AIMode;
  targetQueue: Coordinate[];
  shotsTaken: Set<string>;
};

export function initAI(): AIState {
  return {
    mode: "hunt",
    targetQueue: [],
    shotsTaken: new Set(),
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
  let coord: Coordinate;

  if (aiState.mode === "target" && aiState.targetQueue.length > 0) {
    // Pop from target queue, skip already-shot cells
    let next: Coordinate | undefined;
    const newQueue = [...aiState.targetQueue];
    while (newQueue.length > 0) {
      const candidate = newQueue.shift()!;
      if (!aiState.shotsTaken.has(coordKey(candidate))) {
        next = candidate;
        break;
      }
    }
    if (next) {
      coord = next;
      aiState = { ...aiState, targetQueue: newQueue };
    } else {
      // Queue exhausted, fall back to hunt
      coord = pickRandomUnshot(aiState.shotsTaken);
      aiState = { ...aiState, mode: "hunt", targetQueue: [] };
    }
  } else {
    coord = pickRandomUnshot(aiState.shotsTaken);
    aiState = { ...aiState, mode: "hunt", targetQueue: [] };
  }

  const result = checkShot(coord, playerBoard);
  const newShotsTaken = new Set(aiState.shotsTaken);
  newShotsTaken.add(coordKey(coord));

  let newMode = aiState.mode;
  let newQueue = [...aiState.targetQueue];

  if (result.result === "hit") {
    newMode = "target";
    const adjacent = getAdjacentCells(coord).filter(
      (c) => !newShotsTaken.has(coordKey(c)),
    );
    newQueue.push(...adjacent);
  } else if (result.result === "sunk") {
    // Ship sunk — remove any queued cells that belong to the sunk ship
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
      shotsTaken: newShotsTaken,
    },
  };
}
