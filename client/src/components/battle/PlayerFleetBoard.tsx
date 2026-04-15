"use client";

import { buildCellGrid } from "@battleship/shared";
import { useGameStore } from "@/store/game-store";
import Board from "@/components/board/Board";

export default function PlayerFleetBoard() {
  const yourBoard = useGameStore((s) => s.yourBoard);
  const grid = buildCellGrid(yourBoard, true);

  return (
    <div className="flex flex-col items-center gap-2">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
        Your Fleet
      </h3>
      <Board grid={grid} />
    </div>
  );
}
