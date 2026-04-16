"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { buildCellGrid } from "@battleship/shared";
import { useGameStore } from "@/store/game-store";
import Board from "@/components/board/Board";

export default function GameOverView() {
  const router = useRouter();
  const userId = useGameStore((s) => s.userId);
  const winnerId = useGameStore((s) => s.winnerId);
  const yourBoard = useGameStore((s) => s.yourBoard);
  const opponentBoard = useGameStore((s) => s.opponentBoard);
  const gameMode = useGameStore((s) => s.gameMode);
  const returnToMenu = useGameStore((s) => s.returnToMenu);
  const requestRematch = useGameStore((s) => s.requestRematch);
  const startRematch = useGameStore((s) => s.startRematch);
  const rematchState = useGameStore((s) => s.rematchState);
  const rematchGameId = useGameStore((s) => s.rematchGameId);

  const playerWon = winnerId === userId;

  const playerGrid = buildCellGrid(yourBoard, true);
  const enemyGrid = buildCellGrid(opponentBoard, true);

  useEffect(() => {
    if (rematchGameId) {
      const newId = rematchGameId;
      startRematch();
      router.push(`/game/${newId}`);
    }
  }, [rematchGameId, startRematch, router]);

  function handleMenu() {
    returnToMenu();
    router.push("/");
  }

  const loserLabel = gameMode === "ai" ? "The AI sunk all your ships!" : "Your opponent sunk all your ships!";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <h2
        className={`text-4xl font-bold ${playerWon ? "text-green-400" : "text-red-400"}`}
      >
        {playerWon ? "Victory!" : "Defeat!"}
      </h2>
      <p className="text-slate-400">
        {playerWon ? "You sunk all enemy ships!" : loserLabel}
      </p>

      <div className="flex gap-12 items-start">
        <div className="flex flex-col items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
            Your Fleet
          </h3>
          <Board grid={playerGrid} />
        </div>
        <div className="flex flex-col items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
            Enemy Fleet
          </h3>
          <Board grid={enemyGrid} />
        </div>
      </div>

      <div className="flex gap-4">
        {gameMode === "ai" && (
          <button
            onClick={requestRematch}
            disabled={rematchState === "requested"}
            className="rounded-lg bg-green-600 px-6 py-2 font-semibold transition-colors hover:bg-green-500 disabled:opacity-50"
          >
            Play Again
          </button>
        )}

        {gameMode === "multiplayer" && rematchState === "idle" && (
          <button
            onClick={requestRematch}
            className="rounded-lg bg-green-600 px-6 py-2 font-semibold transition-colors hover:bg-green-500"
          >
            Rematch
          </button>
        )}

        {gameMode === "multiplayer" && rematchState === "requested" && (
          <button
            disabled
            className="rounded-lg bg-green-600 px-6 py-2 font-semibold opacity-50"
          >
            Waiting for opponent...
          </button>
        )}

        {gameMode === "multiplayer" && rematchState === "opponent_requested" && (
          <button
            onClick={requestRematch}
            className="rounded-lg bg-green-600 px-6 py-2 font-semibold transition-colors hover:bg-green-500 animate-pulse"
          >
            Opponent wants rematch!
          </button>
        )}

        <button
          onClick={handleMenu}
          className="rounded-lg border border-slate-600 px-6 py-2 font-semibold transition-colors hover:bg-slate-800"
        >
          Main Menu
        </button>
      </div>
    </div>
  );
}
