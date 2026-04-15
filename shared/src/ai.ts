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
    unsunkHits: [],
  };
}

function inBounds(c: Coordinate): boolean {
  return c.x >= 0 && c.x < BOARD_SIZE && c.y >= 0 && c.y < BOARD_SIZE;
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
    .filter(inBounds);
}

/** Given 2+ collinear hits, return the unshot endpoints extending the line. */
function getLineTargets(
  hits: Coordinate[],
  shotSet: Set<string>,
): Coordinate[] {
  if (hits.length < 2) return [];

  const sameX = hits.every((h) => h.x === hits[0].x);
  const sameY = hits.every((h) => h.y === hits[0].y);
  if (!sameX && !sameY) return [];

  const targets: Coordinate[] = [];

  if (sameX) {
    const col = hits[0].x;
    const ys = hits.map((h) => h.y).sort((a, b) => a - b);
    // Extend upward from the min
    for (let y = ys[0] - 1; y >= 0; y--) {
      const c = { x: col, y };
      if (shotSet.has(coordKey(c))) break; // hit a miss, stop
      targets.push(c);
      break; // only queue the next cell in line
    }
    // Extend downward from the max
    for (let y = ys[ys.length - 1] + 1; y < BOARD_SIZE; y++) {
      const c = { x: col, y };
      if (shotSet.has(coordKey(c))) break;
      targets.push(c);
      break;
    }
  } else {
    const row = hits[0].y;
    const xs = hits.map((h) => h.x).sort((a, b) => a - b);
    // Extend left from the min
    for (let x = xs[0] - 1; x >= 0; x--) {
      const c = { x, y: row };
      if (shotSet.has(coordKey(c))) break;
      targets.push(c);
      break;
    }
    // Extend right from the max
    for (let x = xs[xs.length - 1] + 1; x < BOARD_SIZE; x++) {
      const c = { x, y: row };
      if (shotSet.has(coordKey(c))) break;
      targets.push(c);
      break;
    }
  }

  return targets;
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
  const unsunkHits = [...(aiState.unsunkHits ?? [])];
  let coord: Coordinate;
  let currentMode = aiState.mode;

  if (currentMode === "target" && unsunkHits.length > 0) {
    // With 2+ hits, follow the line; with 1 hit, try adjacent cells
    const candidates =
      unsunkHits.length >= 2
        ? getLineTargets(unsunkHits, shotSet)
        : getAdjacentCells(unsunkHits[0]).filter(
            (c) => !shotSet.has(coordKey(c)),
          );

    const next = candidates.find((c) => !shotSet.has(coordKey(c)));
    if (next) {
      coord = next;
    } else {
      // Fallback: try all adjacent cells of all unsunk hits
      const fallback = unsunkHits
        .flatMap(getAdjacentCells)
        .filter((c) => !shotSet.has(coordKey(c)));
      if (fallback.length > 0) {
        coord = fallback[0];
      } else {
        coord = pickRandomUnshot(shotSet);
        currentMode = "hunt";
      }
    }
  } else {
    coord = pickRandomUnshot(shotSet);
    currentMode = "hunt";
  }

  const result = checkShot(coord, playerBoard);
  shotSet.add(coordKey(coord));

  let newMode = currentMode;
  let newHits = [...unsunkHits];

  if (result.result === "hit") {
    newMode = "target";
    newHits.push(coord);
  } else if (result.result === "sunk") {
    // Remove all cells belonging to the sunk ship from unsunk hits
    const sunkShip = playerBoard.ships.find((s) => s.type === result.shipType);
    if (sunkShip) {
      const sunkCells = new Set(getShipCells(sunkShip).map(coordKey));
      newHits = newHits.filter((c) => !sunkCells.has(coordKey(c)));
    }
    // The sinking shot itself is also a hit on that ship, so no need to add it
    newMode = newHits.length > 0 ? "target" : "hunt";
  }
  // On miss: mode and hits stay the same (keep targeting if we have unsunk hits)

  return {
    coord,
    result,
    newState: {
      mode: newMode,
      targetQueue: [], // kept for backwards compat, no longer used
      shotsTaken: Array.from(shotSet),
      unsunkHits: newHits,
    },
  };
}
