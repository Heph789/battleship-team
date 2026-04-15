"use client";

import { useRouter } from "next/navigation";
import { buildCellGrid } from "@battleship/shared";
import { useGameStore } from "@/store/game-store";
import Board from "@/components/board/Board";

export default function GameOverView() {
  const router = useRouter();
  const game = useGameStore((s) => s.game);
  const rematch = useGameStore((s) => s.rematch);
  const returnToMenu = useGameStore((s) => s.returnToMenu);

  if (!game) return null;

  const playerWon = game.winner === "player";

  // Reveal all ships on both boards
  const playerGrid = buildCellGrid(game.playerBoard, true);
  const aiGrid = buildCellGrid(game.aiBoard, true);

  function handleRematch() {
    const id = rematch();
    router.push(`/game/${id}`);
  }

  function handleMenu() {
    returnToMenu();
    router.push("/");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <h2
        className={`text-4xl font-bold ${playerWon ? "text-green-400" : "text-red-400"}`}
      >
        {playerWon ? "Victory!" : "Defeat!"}
      </h2>
      <p className="text-slate-400">
        {playerWon
          ? "You sunk all enemy ships!"
          : "The AI sunk all your ships!"}
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
          <Board grid={aiGrid} />
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={handleRematch}
          className="rounded-lg bg-blue-600 px-6 py-2 font-semibold transition-colors hover:bg-blue-500"
        >
          Rematch
        </button>
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
