import {
  BOARD_SIZE,
  SHIP_LENGTHS,
  SHIP_TYPES,
  type CellState,
  type Coordinate,
  type Orientation,
  type PlayerBoard,
  type ShipPlacement,
  type ShipType,
  type ShotResult,
} from "./types";

export function getShipCells(ship: ShipPlacement): Coordinate[] {
  const length = SHIP_LENGTHS[ship.type];
  const cells: Coordinate[] = [];
  for (let i = 0; i < length; i++) {
    cells.push({
      x: ship.orientation === "horizontal" ? ship.startX + i : ship.startX,
      y: ship.orientation === "vertical" ? ship.startY + i : ship.startY,
    });
  }
  return cells;
}

export function isInBounds(ship: ShipPlacement): boolean {
  const length = SHIP_LENGTHS[ship.type];
  if (ship.startX < 0 || ship.startY < 0) return false;
  if (ship.orientation === "horizontal") {
    return ship.startX + length <= BOARD_SIZE && ship.startY < BOARD_SIZE;
  }
  return ship.startY + length <= BOARD_SIZE && ship.startX < BOARD_SIZE;
}

export function hasOverlap(
  ship: ShipPlacement,
  existing: ShipPlacement[],
): boolean {
  const newCells = getShipCells(ship);
  const occupied = new Set(
    existing.flatMap(getShipCells).map((c) => `${c.x},${c.y}`),
  );
  return newCells.some((c) => occupied.has(`${c.x},${c.y}`));
}

export function validatePlacement(
  ship: ShipPlacement,
  existing: ShipPlacement[],
): boolean {
  return isInBounds(ship) && !hasOverlap(ship, existing);
}

export function generateRandomPlacements(): ShipPlacement[] {
  const placements: ShipPlacement[] = [];
  for (const type of SHIP_TYPES) {
    let placed = false;
    while (!placed) {
      const orientation: Orientation =
        Math.random() < 0.5 ? "horizontal" : "vertical";
      const length = SHIP_LENGTHS[type];
      const startX =
        orientation === "horizontal"
          ? Math.floor(Math.random() * (BOARD_SIZE - length + 1))
          : Math.floor(Math.random() * BOARD_SIZE);
      const startY =
        orientation === "vertical"
          ? Math.floor(Math.random() * (BOARD_SIZE - length + 1))
          : Math.floor(Math.random() * BOARD_SIZE);
      const ship: ShipPlacement = { type, startX, startY, orientation };
      if (validatePlacement(ship, placements)) {
        placements.push(ship);
        placed = true;
      }
    }
  }
  return placements;
}

export function coordKey(c: Coordinate): string {
  return `${c.x},${c.y}`;
}

export function isAlreadyShot(coord: Coordinate, board: PlayerBoard): boolean {
  const key = coordKey(coord);
  return (
    board.hits.some((c) => coordKey(c) === key) ||
    board.misses.some((c) => coordKey(c) === key)
  );
}

function findShipAt(
  coord: Coordinate,
  ships: ShipPlacement[],
): ShipPlacement | undefined {
  const key = coordKey(coord);
  return ships.find((ship) =>
    getShipCells(ship).some((c) => coordKey(c) === key),
  );
}

function isShipSunk(ship: ShipPlacement, hits: Coordinate[]): boolean {
  const hitSet = new Set(hits.map(coordKey));
  return getShipCells(ship).every((c) => hitSet.has(coordKey(c)));
}

export function checkShot(
  coord: Coordinate,
  targetBoard: PlayerBoard,
): ShotResult {
  const ship = findShipAt(coord, targetBoard.ships);
  if (!ship) {
    return { coordinate: coord, result: "miss" };
  }
  // It's a hit — check if this sinks the ship (including this new hit)
  const allHits = [...targetBoard.hits, coord];
  if (isShipSunk(ship, allHits)) {
    return { coordinate: coord, result: "sunk", shipType: ship.type, sunkShip: ship };
  }
  return { coordinate: coord, result: "hit" };
}

export function checkWin(board: PlayerBoard): boolean {
  return board.ships.every((ship) => isShipSunk(ship, board.hits));
}

export function buildCellGrid(
  board: PlayerBoard,
  showShips: boolean,
): CellState[][] {
  const grid: CellState[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => "empty"),
  );

  // Place ships first if visible
  if (showShips) {
    for (const ship of board.ships) {
      for (const c of getShipCells(ship)) {
        grid[c.y][c.x] = "ship";
      }
    }
  }

  // Mark misses
  for (const c of board.misses) {
    grid[c.y][c.x] = "miss";
  }

  // Mark hits (and sunk)
  const hitSet = new Set(board.hits.map(coordKey));
  for (const c of board.hits) {
    const ship = findShipAt(c, board.ships);
    if (ship && isShipSunk(ship, board.hits)) {
      grid[c.y][c.x] = "sunk";
    } else {
      grid[c.y][c.x] = "hit";
    }
  }

  return grid;
}

// Returns all sunk ship types on a board
export function getSunkShips(board: PlayerBoard): ShipType[] {
  return board.ships
    .filter((ship) => isShipSunk(ship, board.hits))
    .map((ship) => ship.type);
}
