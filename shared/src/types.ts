export const BOARD_SIZE = 10;

export type Coordinate = { x: number; y: number };
export type Orientation = "horizontal" | "vertical";

export const SHIP_TYPES = [
  "carrier",
  "battleship",
  "cruiser",
  "submarine",
  "destroyer",
] as const;
export type ShipType = (typeof SHIP_TYPES)[number];

export const SHIP_LENGTHS: Record<ShipType, number> = {
  carrier: 5,
  battleship: 4,
  cruiser: 3,
  submarine: 3,
  destroyer: 2,
};

export const SHIP_LABELS: Record<ShipType, string> = {
  carrier: "Carrier",
  battleship: "Battleship",
  cruiser: "Cruiser",
  submarine: "Submarine",
  destroyer: "Destroyer",
};

export type ShipPlacement = {
  type: ShipType;
  startX: number;
  startY: number;
  orientation: Orientation;
};

export type CellState = "empty" | "ship" | "hit" | "miss" | "sunk";

export type GamePhase = "placing_ships" | "in_progress" | "completed";

export type Player = "player" | "ai";

export type ShotResult = {
  coordinate: Coordinate;
  result: "hit" | "miss" | "sunk";
  shipType?: ShipType;
};

export type PlayerBoard = {
  ships: ShipPlacement[];
  hits: Coordinate[];
  misses: Coordinate[];
};

export type GameState = {
  id: string;
  phase: GamePhase;
  currentTurn: Player;
  playerBoard: PlayerBoard;
  aiBoard: PlayerBoard;
  winner: Player | null;
};
