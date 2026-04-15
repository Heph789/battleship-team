"use client";

import { buildCellGrid } from "@battleship/shared";
import { useGameStore } from "@/store/game-store";
import Board from "@/components/board/Board";

export default function OpponentTargetBoard() {
  const game = useGameStore((s) => s.game);
  const fireShot = useGameStore((s) => s.fireShot);
  const isAiThinking = useGameStore((s) => s.isAiThinking);
  if (!game) return null;

  // Don't show AI's ships — only hits/misses
  const grid = buildCellGrid(game.aiBoard, false);

  return (
    <div className="flex flex-col items-center gap-2">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
        Enemy Waters
      </h3>
      <Board
        grid={grid}
        interactive={!isAiThinking && game.currentTurn === "player"}
        onCellClick={(coord) => fireShot(coord)}
      />
    </div>
  );
}
