import { create } from "zustand";
import {
  SHIP_TYPES,
  SHIP_LABELS,
  type Coordinate,
  type GameMode,
  type GameStatus,
  type Orientation,
  type PlayerBoard,
  type ShipPlacement,
  type ShipType,
  type ShotResult,
  validatePlacement,
} from "@battleship/shared";
import {
  connectSocket,
  getSocket,
  getSessionToken,
  setSessionToken,
  type TypedSocket,
} from "@/lib/socket";

interface GameStore {
  // Connection state
  userId: string | null;
  connected: boolean;
  gameId: string | null;
  gameCode: string | null;
  gameMode: GameMode | null;
  gameStatus: GameStatus | null;

  // Game state (from server)
  yourBoard: PlayerBoard;
  opponentBoard: PlayerBoard;
  currentTurn: string | null;
  isYourTurn: boolean;
  winnerId: string | null;

  // Placement UI state (local)
  placementShips: ShipPlacement[];
  activeShipType: ShipType | null;
  activeOrientation: Orientation;
  hoverCell: Coordinate | null;

  // UI state
  shotMessage: string | null;
  isOpponentThinking: boolean;
  waitingForOpponent: boolean;
  rematchRequested: boolean;
  errorMessage: string | null;

  // Actions: connection
  initSession: () => Promise<void>;

  // Actions: lobby
  createGame: (mode: GameMode) => void;
  joinGame: (code: string) => void;

  // Actions: placement (local validation, server submission)
  setActiveShip: (type: ShipType) => void;
  rotateShip: () => void;
  setHoverCell: (coord: Coordinate | null) => void;
  placeShip: (coord: Coordinate) => boolean;
  removeShip: (type: ShipType) => void;
  confirmPlacement: () => void;

  // Actions: firing
  fireShot: (coord: Coordinate) => void;

  // Actions: post-game
  rematch: () => void;
  returnToMenu: () => void;
}

const emptyBoard: PlayerBoard = { ships: [], hits: [], misses: [] };

function shotResultMessage(result: ShotResult, prefix: string): string {
  if (result.result === "sunk") {
    return `${prefix} sunk the ${SHIP_LABELS[result.shipType!]}!`;
  }
  if (result.result === "hit") return `${prefix} hit!`;
  return `${prefix} miss.`;
}

export const useGameStore = create<GameStore>((set, get) => {
  let initialized = false;

  // Set up socket listeners once the store is created
  function bindSocketListeners(socket: TypedSocket) {
    socket.on("game_created", ({ gameId, code }) => {
      set({
        gameId,
        gameCode: code,
        gameStatus: get().gameMode === "ai" ? "placing_ships" : "waiting",
        waitingForOpponent: get().gameMode === "multiplayer",
      });
    });

    socket.on("game_joined", ({ gameId }) => {
      set({
        gameId,
        gameStatus: "placing_ships",
        waitingForOpponent: false,
      });
    });

    socket.on("opponent_joined", () => {
      set({
        gameStatus: "placing_ships",
        waitingForOpponent: false,
      });
    });

    socket.on("ships_accepted", () => {
      const { gameMode, placementShips, yourBoard } = get();
      const updates: Partial<GameStore> = {
        yourBoard: { ...yourBoard, ships: placementShips },
      };
      if (gameMode === "multiplayer") {
        updates.waitingForOpponent = true;
        updates.shotMessage = "Waiting for opponent to place ships...";
      }
      set(updates);
    });

    socket.on("both_ready", ({ currentTurn }) => {
      const { userId, placementShips, yourBoard } = get();
      set({
        gameStatus: "in_progress",
        currentTurn,
        isYourTurn: currentTurn === userId,
        waitingForOpponent: false,
        yourBoard: yourBoard.ships.length > 0
          ? yourBoard
          : { ...yourBoard, ships: placementShips },
        shotMessage:
          currentTurn === userId
            ? "Your turn — fire at the enemy grid!"
            : "Opponent's turn...",
      });
    });

    socket.on("fire_result", ({ coordinate, result, shipType, sunkShip, gameOver }) => {
      const { opponentBoard } = get();
      const newBoard = { ...opponentBoard };
      if (result === "miss") {
        newBoard.misses = [...newBoard.misses, coordinate];
      } else {
        newBoard.hits = [...newBoard.hits, coordinate];
      }
      if (sunkShip) {
        newBoard.ships = [...newBoard.ships, sunkShip];
      }
      const msg = shotResultMessage(
        { coordinate, result, shipType },
        "You",
      );

      if (gameOver) {
        set({
          opponentBoard: newBoard,
          gameStatus: "completed",
          winnerId: get().userId,
          shotMessage: "You win! All enemy ships sunk!",
          isOpponentThinking: false,
        });
      } else {
        set({
          opponentBoard: newBoard,
          isYourTurn: false,
          isOpponentThinking: true,
          shotMessage: msg,
        });
      }
    });

    socket.on("opponent_fired", ({ coordinate, result, shipType, gameOver }) => {
      const { yourBoard, userId } = get();
      const newBoard = { ...yourBoard };
      if (result === "miss") {
        newBoard.misses = [...newBoard.misses, coordinate];
      } else {
        newBoard.hits = [...newBoard.hits, coordinate];
      }
      const msg = shotResultMessage(
        { coordinate, result, shipType },
        get().gameMode === "ai" ? "AI" : "Opponent",
      );

      if (gameOver) {
        set({
          yourBoard: newBoard,
          gameStatus: "completed",
          winnerId: "opponent",
          shotMessage:
            get().gameMode === "ai"
              ? "AI wins! All your ships are sunk!"
              : "Opponent wins! All your ships are sunk!",
          isOpponentThinking: false,
        });
      } else {
        set({
          yourBoard: newBoard,
          isYourTurn: true,
          isOpponentThinking: false,
          shotMessage: `${msg} Your turn!`,
        });
      }
    });

    socket.on("game_over", ({ winnerId }) => {
      set({
        gameStatus: "completed",
        winnerId,
        isOpponentThinking: false,
      });
    });

    socket.on("rematch_requested", () => {
      set({ rematchRequested: true });
    });

    socket.on("rematch_created", ({ gameId }) => {
      set({
        gameId,
        gameStatus: "placing_ships",
        yourBoard: emptyBoard,
        opponentBoard: emptyBoard,
        placementShips: [],
        activeShipType: SHIP_TYPES[0],
        activeOrientation: "horizontal",
        hoverCell: null,
        currentTurn: null,
        isYourTurn: false,
        winnerId: null,
        shotMessage: null,
        isOpponentThinking: false,
        waitingForOpponent: false,
        rematchRequested: false,
        errorMessage: null,
      });
    });

    socket.on("reconnect_state", (data) => {
      set({
        gameId: data.gameId,
        gameMode: data.mode,
        gameStatus: data.status,
        yourBoard: { ...data.yourBoard },
        opponentBoard: data.opponentBoard,
        placementShips: data.yourShips,
        currentTurn: data.currentTurn,
        isYourTurn: data.isYourTurn,
        winnerId: data.winnerId,
        shotMessage: data.isYourTurn ? "Your turn!" : "Opponent's turn...",
        isOpponentThinking: !data.isYourTurn && data.status === "in_progress",
      });
    });

    socket.on("error", ({ message }) => {
      set({ errorMessage: message });
    });
  }

  return {
    // Initial state
    userId: null,
    connected: false,
    gameId: null,
    gameCode: null,
    gameMode: null,
    gameStatus: null,
    yourBoard: emptyBoard,
    opponentBoard: emptyBoard,
    currentTurn: null,
    isYourTurn: false,
    winnerId: null,
    placementShips: [],
    activeShipType: SHIP_TYPES[0],
    activeOrientation: "horizontal",
    hoverCell: null,
    shotMessage: null,
    isOpponentThinking: false,
    waitingForOpponent: false,
    rematchRequested: false,
    errorMessage: null,

    initSession: async () => {
      if (initialized) return;
      initialized = true;

      const SERVER_URL =
        process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";
      const existingToken = getSessionToken();
      const headers: Record<string, string> = {};
      if (existingToken) {
        headers["Authorization"] = `Bearer ${existingToken}`;
      }
      const res = await fetch(`${SERVER_URL}/api/session`, { headers });
      const { userId, token } = await res.json();
      if (token) setSessionToken(token);
      set({ userId, connected: true });
      const socket = connectSocket();
      bindSocketListeners(socket);
    },

    createGame: (mode) => {
      set({
        gameMode: mode,
        gameStatus: null,
        yourBoard: emptyBoard,
        opponentBoard: emptyBoard,
        placementShips: [],
        activeShipType: SHIP_TYPES[0],
        activeOrientation: "horizontal",
        hoverCell: null,
        currentTurn: null,
        isYourTurn: false,
        winnerId: null,
        shotMessage: null,
        isOpponentThinking: false,
        waitingForOpponent: false,
        rematchRequested: false,
        errorMessage: null,
        gameCode: null,
      });
      getSocket().emit("create_game", { mode });
    },

    joinGame: (code) => {
      set({
        gameMode: "multiplayer",
        gameStatus: null,
        yourBoard: emptyBoard,
        opponentBoard: emptyBoard,
        placementShips: [],
        activeShipType: SHIP_TYPES[0],
        activeOrientation: "horizontal",
        errorMessage: null,
      });
      getSocket().emit("join_game", { code: code.toUpperCase() });
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

      const others = placementShips.filter((s) => s.type !== activeShipType);
      if (!validatePlacement(ship, others)) return false;

      const newPlacements = [...others, ship];
      const placedTypes = new Set(newPlacements.map((s) => s.type));
      const nextShip = SHIP_TYPES.find((t) => !placedTypes.has(t)) ?? null;

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
      const { placementShips } = get();
      if (placementShips.length !== SHIP_TYPES.length) return;
      getSocket().emit("place_ships", { ships: placementShips });
    },

    fireShot: (coord) => {
      const { gameStatus, isYourTurn, isOpponentThinking } = get();
      if (gameStatus !== "in_progress" || !isYourTurn || isOpponentThinking)
        return;
      getSocket().emit("fire", { x: coord.x, y: coord.y });
    },

    rematch: () => {
      const { gameId } = get();
      if (!gameId) return;
      getSocket().emit("rematch", { gameId });
    },

    returnToMenu: () => {
      getSocket().emit("leave_game");
      set({
        gameId: null,
        gameCode: null,
        gameMode: null,
        gameStatus: null,
        yourBoard: emptyBoard,
        opponentBoard: emptyBoard,
        placementShips: [],
        activeShipType: null,
        hoverCell: null,
        currentTurn: null,
        isYourTurn: false,
        winnerId: null,
        shotMessage: null,
        isOpponentThinking: false,
        waitingForOpponent: false,
        rematchRequested: false,
        errorMessage: null,
      });
    },
  };
});
