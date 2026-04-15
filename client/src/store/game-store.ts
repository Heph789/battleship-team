import { create } from "zustand";
import {
  SHIP_TYPES,
  SHIP_LABELS,
  type Coordinate,
  type GameState,
  type Orientation,
  type ShipPlacement,
  type ShipType,
  type ShotResult,
  validatePlacement,
  generateRandomPlacements,
  checkShot,
  checkWin,
  isAlreadyShot,
  coordKey,
} from "@battleship/shared";
import { type AIState, initAI, aiTakeShot } from "@/ai/ai-player";

interface GameStore {
  // Game state
  game: GameState | null;

  // Placement UI state
  placementShips: ShipPlacement[];
  activeShipType: ShipType | null;
  activeOrientation: Orientation;
  hoverCell: Coordinate | null;

  // AI state
  aiState: AIState | null;
  shotMessage: string | null;
  isAiThinking: boolean;

  // Actions: lifecycle
  startNewGame: () => string;
  returnToMenu: () => void;

  // Actions: placement
  setActiveShip: (type: ShipType) => void;
  rotateShip: () => void;
  setHoverCell: (coord: Coordinate | null) => void;
  placeShip: (coord: Coordinate) => boolean;
  removeShip: (type: ShipType) => void;
  confirmPlacement: () => void;

  // Actions: firing
  fireShot: (coord: Coordinate) => ShotResult | null;
  _aiFireBack: () => void;

  // Actions: post-game
  rematch: () => string;
}

function generateId(): string {
  return crypto.randomUUID();
}

function shotResultMessage(result: ShotResult, prefix: string): string {
  if (result.result === "sunk") {
    return `${prefix} sunk the ${SHIP_LABELS[result.shipType!]}!`;
  }
  if (result.result === "hit") return `${prefix} hit!`;
  return `${prefix} miss.`;
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  placementShips: [],
  activeShipType: SHIP_TYPES[0],
  activeOrientation: "horizontal",
  hoverCell: null,
  aiState: null,
  shotMessage: null,
  isAiThinking: false,

  startNewGame: () => {
    const id = generateId();
    const game: GameState = {
      id,
      phase: "placing_ships",
      currentTurn: "player",
      playerBoard: { ships: [], hits: [], misses: [] },
      aiBoard: { ships: [], hits: [], misses: [] },
      winner: null,
    };
    set({
      game,
      placementShips: [],
      activeShipType: SHIP_TYPES[0],
      activeOrientation: "horizontal",
      hoverCell: null,
      aiState: initAI(),
      shotMessage: null,
      isAiThinking: false,
    });
    return id;
  },

  returnToMenu: () => {
    set({
      game: null,
      placementShips: [],
      activeShipType: null,
      aiState: null,
      shotMessage: null,
      isAiThinking: false,
    });
  },

  setActiveShip: (type) => set({ activeShipType: type }),

  rotateShip: () =>
    set((s) => ({
      activeOrientation:
        s.activeOrientation === "horizontal" ? "vertical" : "horizontal",
    })),

  setHoverCell: (coord) => set({ hoverCell: coord }),

  placeShip: (coord) => {
    const { activeShipType, activeOrientation, placementShips } = get();
    if (!activeShipType) return false;

    const ship: ShipPlacement = {
      type: activeShipType,
      startX: coord.x,
      startY: coord.y,
      orientation: activeOrientation,
    };

    // Filter out any existing placement of same type (allow re-place)
    const others = placementShips.filter((s) => s.type !== activeShipType);
    if (!validatePlacement(ship, others)) return false;

    const newPlacements = [...others, ship];

    // Advance to next unplaced ship
    const placedTypes = new Set(newPlacements.map((s) => s.type));
    const nextShip =
      SHIP_TYPES.find((t) => !placedTypes.has(t)) ?? null;

    set({
      placementShips: newPlacements,
      activeShipType: nextShip,
    });
    return true;
  },

  removeShip: (type) => {
    set((s) => ({
      placementShips: s.placementShips.filter((ship) => ship.type !== type),
      activeShipType: type,
    }));
  },

  confirmPlacement: () => {
    const { game, placementShips } = get();
    if (!game || placementShips.length !== SHIP_TYPES.length) return;

    const aiShips = generateRandomPlacements();
    set({
      game: {
        ...game,
        phase: "in_progress",
        currentTurn: "player",
        playerBoard: { ...game.playerBoard, ships: placementShips },
        aiBoard: { ...game.aiBoard, ships: aiShips },
      },
      shotMessage: "Your turn — fire at the enemy grid!",
    });
  },

  fireShot: (coord) => {
    const { game, isAiThinking } = get();
    if (!game || game.phase !== "in_progress" || game.currentTurn !== "player")
      return null;
    if (isAiThinking) return null;
    if (isAlreadyShot(coord, game.aiBoard)) return null;

    const result = checkShot(coord, game.aiBoard);
    const newAiBoard = { ...game.aiBoard };
    if (result.result === "miss") {
      newAiBoard.misses = [...newAiBoard.misses, coord];
    } else {
      newAiBoard.hits = [...newAiBoard.hits, coord];
    }

    const playerWon = checkWin(newAiBoard);
    const message = shotResultMessage(result, "You");

    if (playerWon) {
      set({
        game: {
          ...game,
          aiBoard: newAiBoard,
          phase: "completed",
          winner: "player",
        },
        shotMessage: "You win! All enemy ships sunk!",
      });
      return result;
    }

    set({
      game: {
        ...game,
        aiBoard: newAiBoard,
        currentTurn: "ai",
      },
      shotMessage: message,
      isAiThinking: true,
    });

    // AI fires back after a delay
    setTimeout(() => get()._aiFireBack(), 600);

    return result;
  },

  _aiFireBack: () => {
    const { game, aiState } = get();
    if (!game || !aiState || game.phase !== "in_progress") return;

    const { coord, result, newState } = aiTakeShot(aiState, game.playerBoard);
    const newPlayerBoard = { ...game.playerBoard };
    if (result.result === "miss") {
      newPlayerBoard.misses = [...newPlayerBoard.misses, coord];
    } else {
      newPlayerBoard.hits = [...newPlayerBoard.hits, coord];
    }

    const aiWon = checkWin(newPlayerBoard);
    const message = shotResultMessage(result, "AI");

    if (aiWon) {
      set({
        game: {
          ...game,
          playerBoard: newPlayerBoard,
          phase: "completed",
          winner: "ai",
        },
        aiState: newState,
        shotMessage: "AI wins! All your ships are sunk!",
        isAiThinking: false,
      });
      return;
    }

    set({
      game: {
        ...game,
        playerBoard: newPlayerBoard,
        currentTurn: "player",
      },
      aiState: newState,
      shotMessage: `${message} Your turn!`,
      isAiThinking: false,
    });
  },

  rematch: () => {
    return get().startNewGame();
  },
}));
