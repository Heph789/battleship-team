"use client";

import { buildCellGrid } from "@battleship/shared";
import { useGameStore } from "@/store/game-store";
import Board from "@/components/board/Board";

export default function OpponentTargetBoard() {
  const opponentBoard = useGameStore((s) => s.opponentBoard);
  const fireShot = useGameStore((s) => s.fireShot);
  const isYourTurn = useGameStore((s) => s.isYourTurn);
  const isOpponentThinking = useGameStore((s) => s.isOpponentThinking);

  // Don't show opponent's ships — only hits/misses
  const grid = buildCellGrid(opponentBoard, false);

  return (
    <div className="flex flex-col items-center gap-2">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
        Enemy Waters
      </h3>
      <Board
        grid={grid}
        interactive={!isOpponentThinking && isYourTurn}
        onCellClick={(coord) => fireShot(coord)}
      />
    </div>
  );
}
