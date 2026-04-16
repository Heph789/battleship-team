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

export type GameMode = "ai" | "multiplayer" | "team";

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
  teamState: TeamGameState | null;
};

// --- Team mode types ---

export type TeamId = "teamA" | "teamB";

export type TeamPlayerState = {
  ready: boolean;
  hitCount: number;
};

export type TeamTurnPhase = "firing" | "sharing" | "waiting";

export type TeamShotResult = {
  coordinate: Coordinate;
  result: "hit" | "miss" | "sunk" | "wasted";
  shipType?: ShipType;
  sunkShip?: ShipPlacement;
  alreadyHitBy?: string;
  revealedSunkShip?: ShipPlacement;
};

export type TeamGameState = {
  teams: Record<TeamId, { playerIds: string[] }>;
  boards: Record<TeamId, PlayerBoard>;
  playerViews: Record<string, PlayerBoard>;
  players: Record<string, TeamPlayerState>;
  placementShips: Record<TeamId, ShipPlacement[]>;
  currentTeamTurn: TeamId;
  turnPhase: TeamTurnPhase;
  pendingShots: Record<string, { x: number; y: number } | null>;
  pendingResults: Record<string, TeamShotResult | null>;
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
  // Team mode
  join_team_game: (data: { code: string }) => void;
  team_place_ship: (data: { ship: ShipPlacement }) => void;
  team_remove_ship: (data: { shipType: ShipType }) => void;
  team_lock_in: () => void;
  team_fire: (data: { x: number; y: number }) => void;
  team_share_decision: (data: { share: boolean }) => void;
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
    // Team mode fields (present when mode === "team")
    teamId?: TeamId;
    teams?: Record<TeamId, { playerIds: string[]; displayNames: string[] }>;
    teamBoard?: PlayerBoard;
    myEnemyView?: PlayerBoard;
    hitCount?: number;
    currentTeamTurn?: TeamId;
    turnPhase?: TeamTurnPhase;
    teammateReady?: boolean;
    placementShips?: ShipPlacement[];
  }) => void;
  error: (data: { message: string }) => void;
  // Team mode
  team_lobby_update: (data: {
    teams: Record<TeamId, { playerIds: string[]; displayNames: string[] }>;
    playerCount: number;
  }) => void;
  teammate_placed_ship: (data: { ship: ShipPlacement }) => void;
  teammate_removed_ship: (data: { shipType: ShipType }) => void;
  teammate_locked_in: () => void;
  team_both_ready: (data: {
    currentTeamTurn: TeamId;
  }) => void;
  team_turn_start: (data: { currentTeamTurn: TeamId }) => void;
  team_shot_result: (data: TeamShotResult & { phase: "share_prompt" | "done" }) => void;
  team_waiting_for_teammate: () => void;
  team_teammate_shot_done: () => void;
  team_share_received: (data: {
    coordinate: Coordinate;
    result: "hit" | "sunk";
    shipType?: ShipType;
    sunkShip?: ShipPlacement;
  }) => void;
  team_round_complete: (data: { nextTeamTurn: TeamId }) => void;
  team_opponent_turn_result: (data: {
    hitsOnYourBoard: Coordinate[];
    missesOnYourBoard: Coordinate[];
    sunkShips: ShipPlacement[];
  }) => void;
  team_game_over: (data: {
    winningTeam: TeamId;
    hitCounts: Record<string, number>;
    mvp: string;
  }) => void;
}
