"use client";

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

  const playerWon = winnerId === userId;

  const playerGrid = buildCellGrid(yourBoard, true);
  const enemyGrid = buildCellGrid(opponentBoard, true);

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

      <button
        onClick={handleMenu}
        className="rounded-lg bg-blue-600 px-6 py-2 font-semibold transition-colors hover:bg-blue-500"
      >
        Main Menu
      </button>
    </div>
  );
}
