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
  sunkShip?: ShipPlacement;
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

// --- Server types ---

export type GameMode = "ai" | "multiplayer";

export type GameStatus =
  | "waiting"
  | "placing_ships"
  | "in_progress"
  | "completed"
  | "abandoned";

export type AIMode = "hunt" | "target";

export type AIState = {
  mode: AIMode;
  targetQueue: Coordinate[];
  shotsTaken: string[];
  unsunkHits: Coordinate[];
};

export type ServerGameState = {
  players: Record<string, { ships: ShipPlacement[]; ready: boolean }>;
  boards: Record<string, PlayerBoard>;
  currentTurn: string; // usedId
  aiState: AIState | null;
};

// --- Socket.IO event interfaces ---

export interface ClientToServerEvents {
  create_game: (data: { mode: GameMode }) => void;
  join_game: (data: { code: string }) => void;
  reconnect_game: (data: { gameId: string }) => void;
  leave_game: () => void;
  place_ships: (data: { ships: ShipPlacement[] }) => void;
  fire: (data: { x: number; y: number }) => void;
  rematch: (data: { gameId: string }) => void;
}

export interface ServerToClientEvents {
  game_created: (data: { gameId: string; code: string | null }) => void;
  game_joined: (data: { gameId: string }) => void;
  opponent_joined: () => void;
  ships_accepted: () => void;
  both_ready: (data: { currentTurn: string }) => void;
  fire_result: (data: ShotResult & { gameOver: boolean }) => void;
  opponent_fired: (data: ShotResult & { gameOver: boolean }) => void;
  game_over: (data: { winnerId: string }) => void;
  rematch_requested: () => void;
  rematch_created: (data: { gameId: string }) => void;
  reconnect_state: (data: {
    gameId: string;
    mode: GameMode;
    status: GameStatus;
    yourShips: ShipPlacement[];
    yourBoard: PlayerBoard;
    opponentBoard: PlayerBoard;
    currentTurn: string;
    winnerId: string | null;
    isYourTurn: boolean;
  }) => void;
  error: (data: { message: string }) => void;
}
