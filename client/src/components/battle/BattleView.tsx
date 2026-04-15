"use client";

import { useGameStore } from "@/store/game-store";
import PlayerFleetBoard from "./PlayerFleetBoard";
import OpponentTargetBoard from "./OpponentTargetBoard";

export default function BattleView() {
  const shotMessage = useGameStore((s) => s.shotMessage);
  const isOpponentThinking = useGameStore((s) => s.isOpponentThinking);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <div className="h-8 text-center">
        {isOpponentThinking ? (
          <p className="text-yellow-400 font-medium animate-pulse">
            Opponent is thinking...
          </p>
        ) : (
          shotMessage && (
            <p className="text-slate-200 font-medium">{shotMessage}</p>
          )
        )}
      </div>
      <div className="flex gap-12 items-start">
        <PlayerFleetBoard />
        <OpponentTargetBoard />
      </div>
    </div>
  );
}
