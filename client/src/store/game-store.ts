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
  type TeamId,
  type TeamShotResult,
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

  // Team mode state
  teamId: TeamId | null;
  teams: Record<TeamId, { playerIds: string[]; displayNames: string[] }> | null;
  teamBoard: PlayerBoard;
  myEnemyView: PlayerBoard;
  hitCount: number;
  currentTeamTurn: TeamId | null;
  sharePromptResult: TeamShotResult | null;
  waitingForTeammate: boolean;
  wastedCells: Coordinate[];
  gameOverHitCounts: Record<string, number> | null;
  mvp: string | null;
  teammateReady: boolean;
  teamPlayerCount: number;

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

  // Actions: team placement
  joinTeamGame: (code: string) => void;
  teamPlaceShip: (coord: Coordinate) => boolean;
  teamRemoveShip: (type: ShipType) => void;
  teamLockIn: () => void;

  // Actions: firing
  fireShot: (coord: Coordinate) => void;
  teamFire: (coord: Coordinate) => void;
  teamShareDecision: (share: boolean) => void;

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
      const mode = get().gameMode;
      set({
        gameId,
        gameCode: code,
        gameStatus: mode === "ai" ? "placing_ships" : "waiting",
        waitingForOpponent: mode === "multiplayer" || mode === "team",
        teamPlayerCount: mode === "team" ? 1 : 0,
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
      const { yourBoard } = get();
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

    // Team mode listeners
    socket.on("team_lobby_update", ({ teams, playerCount }) => {
      const { userId } = get();
      let myTeam: TeamId | null = null;
      if (userId) {
        if (teams.teamA.playerIds.includes(userId)) myTeam = "teamA";
        else if (teams.teamB.playerIds.includes(userId)) myTeam = "teamB";
      }
      set({
        teams,
        teamId: myTeam,
        teamPlayerCount: playerCount,
        waitingForOpponent: playerCount < 4,
        gameStatus: playerCount < 4 ? "waiting" : "placing_ships",
      });
    });

    socket.on("teammate_placed_ship", ({ ship }) => {
      const { placementShips } = get();
      const others = placementShips.filter((s) => s.type !== ship.type);
      set({ placementShips: [...others, ship] });
    });

    socket.on("teammate_removed_ship", ({ shipType }) => {
      set((s) => ({
        placementShips: s.placementShips.filter((ship) => ship.type !== shipType),
      }));
    });

    socket.on("teammate_locked_in", () => {
      set({ teammateReady: true });
    });

    socket.on("team_both_ready", ({ currentTeamTurn }) => {
      const { teamId, placementShips } = get();
      const isMyTeamsTurn = currentTeamTurn === teamId;
      set({
        gameStatus: "in_progress",
        currentTeamTurn,
        isYourTurn: isMyTeamsTurn,
        waitingForOpponent: false,
        teamBoard: { ships: placementShips, hits: [], misses: [] },
        myEnemyView: emptyBoard,
        hitCount: 0,
        waitingForTeammate: false,
        sharePromptResult: null,
        shotMessage: isMyTeamsTurn
          ? "Your team's turn — fire!"
          : "Enemy team's turn...",
      });
    });

    socket.on("team_turn_start", ({ currentTeamTurn }) => {
      const { teamId } = get();
      const isMyTeamsTurn = currentTeamTurn === teamId;
      set({
        currentTeamTurn,
        isYourTurn: isMyTeamsTurn,
        waitingForTeammate: false,
        sharePromptResult: null,
        isOpponentThinking: !isMyTeamsTurn,
        shotMessage: isMyTeamsTurn
          ? "Your team's turn — fire!"
          : "Enemy team's turn...",
      });
    });

    socket.on("team_shot_result", (data) => {
      const { myEnemyView } = get();

      // Update your private view with your shot result
      if (data.result === "miss") {
        set({
          myEnemyView: {
            ...myEnemyView,
            misses: [...myEnemyView.misses, data.coordinate],
          },
        });
      } else if (data.result === "hit" || data.result === "sunk") {
        const updatedView = {
          ...myEnemyView,
          hits: [...myEnemyView.hits, data.coordinate],
        };
        if (data.sunkShip) {
          updatedView.ships = [...myEnemyView.ships, data.sunkShip];
        }
        set({
          myEnemyView: updatedView,
          hitCount: get().hitCount + 1,
        });
      } else if (data.result === "wasted") {
        // Wasted shot — mark as hit on view (it was already hit)
        const updatedView = { ...myEnemyView };
        const key = `${data.coordinate.x},${data.coordinate.y}`;
        const alreadyInHits = myEnemyView.hits.some(
          (c) => `${c.x},${c.y}` === key,
        );
        if (!alreadyInHits) {
          updatedView.hits = [...updatedView.hits, data.coordinate];
        }
        if (data.revealedSunkShip) {
          updatedView.ships = [...updatedView.ships, data.revealedSunkShip];
        }
        set({
          myEnemyView: updatedView,
          wastedCells: [...get().wastedCells, data.coordinate],
        });
      }

      if (data.phase === "share_prompt") {
        set({
          sharePromptResult: data,
          waitingForTeammate: false,
          shotMessage: `You ${data.result === "sunk" ? "sunk" : "hit"} a ship! Share with teammate?`,
        });
      } else {
        const msg = data.result === "wasted"
          ? "Wasted shot — already hit!"
          : data.result === "miss"
            ? "Miss."
            : data.result === "sunk"
              ? `Sunk the ${SHIP_LABELS[data.shipType!]}!`
              : "Hit!";
        set({
          waitingForTeammate: false,
          shotMessage: msg,
        });
      }
    });

    socket.on("team_waiting_for_teammate", () => {
      set({
        waitingForTeammate: true,
        shotMessage: "Waiting for teammate to fire...",
      });
    });

    socket.on("team_teammate_shot_done", () => {
      // Teammate has fired, results are incoming
    });

    socket.on("team_share_received", ({ coordinate, result, shipType, sunkShip }) => {
      const { myEnemyView } = get();
      const updatedView = {
        ...myEnemyView,
        hits: [...myEnemyView.hits, coordinate],
      };
      if (sunkShip) {
        updatedView.ships = [...myEnemyView.ships, sunkShip];
      }
      set({
        myEnemyView: updatedView,
        shotMessage: `Teammate shared: ${result === "sunk" ? `Sunk the ${SHIP_LABELS[shipType!]}!` : "Hit!"}`,
      });
    });

    socket.on("team_round_complete", ({ nextTeamTurn }) => {
      const { teamId } = get();
      const isMyTeamsTurn = nextTeamTurn === teamId;
      set({
        currentTeamTurn: nextTeamTurn,
        isYourTurn: isMyTeamsTurn,
        waitingForTeammate: false,
        sharePromptResult: null,
        isOpponentThinking: !isMyTeamsTurn,
      });
    });

    socket.on("team_opponent_turn_result", ({ hitsOnYourBoard, missesOnYourBoard, sunkShips }) => {
      const { teamBoard } = get();
      set({
        teamBoard: {
          ...teamBoard,
          hits: [...teamBoard.hits, ...hitsOnYourBoard],
          misses: [...teamBoard.misses, ...missesOnYourBoard],
        },
      });
    });

    socket.on("team_game_over", ({ winningTeam, hitCounts, mvp }) => {
      set({
        gameStatus: "completed",
        gameOverHitCounts: hitCounts,
        mvp,
        winnerId: winningTeam,
        isOpponentThinking: false,
        sharePromptResult: null,
        waitingForTeammate: false,
      });
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
    teamId: null,
    teams: null,
    teamBoard: emptyBoard,
    myEnemyView: emptyBoard,
    hitCount: 0,
    currentTeamTurn: null,
    sharePromptResult: null,
    waitingForTeammate: false,
    wastedCells: [],
    gameOverHitCounts: null,
    mvp: null,
    teammateReady: false,
    teamPlayerCount: 0,
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

    joinTeamGame: (code) => {
      set({
        gameMode: "team",
        gameStatus: null,
        yourBoard: emptyBoard,
        opponentBoard: emptyBoard,
        teamBoard: emptyBoard,
        myEnemyView: emptyBoard,
        placementShips: [],
        activeShipType: SHIP_TYPES[0],
        activeOrientation: "horizontal",
        errorMessage: null,
        hitCount: 0,
        gameOverHitCounts: null,
        mvp: null,
        teammateReady: false,
        sharePromptResult: null,
        waitingForTeammate: false,
        wastedCells: [],
        currentTeamTurn: null,
      });
      getSocket().emit("join_team_game", { code: code.toUpperCase() });
    },

    teamPlaceShip: (coord) => {
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

      // Emit to server for teammate sync
      getSocket().emit("team_place_ship", { ship });
      return true;
    },

    teamRemoveShip: (type) => {
      set((s) => ({
        placementShips: s.placementShips.filter((ship) => ship.type !== type),
        activeShipType: type,
      }));
      getSocket().emit("team_remove_ship", { shipType: type });
    },

    teamLockIn: () => {
      getSocket().emit("team_lock_in");
    },

    fireShot: (coord) => {
      const { gameStatus, isYourTurn, isOpponentThinking } = get();
      if (gameStatus !== "in_progress" || !isYourTurn || isOpponentThinking)
        return;
      getSocket().emit("fire", { x: coord.x, y: coord.y });
    },

    teamFire: (coord) => {
      const { gameStatus, isYourTurn, waitingForTeammate, sharePromptResult } = get();
      if (gameStatus !== "in_progress" || !isYourTurn || waitingForTeammate || sharePromptResult)
        return;
      getSocket().emit("team_fire", { x: coord.x, y: coord.y });
    },

    teamShareDecision: (share) => {
      set({ sharePromptResult: null });
      getSocket().emit("team_share_decision", { share });
    },

    rematch: () => {
      const { gameId } = get();
      if (!gameId) return;
      getSocket().emit("rematch", { gameId });
    },

    returnToMenu: () => {
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
