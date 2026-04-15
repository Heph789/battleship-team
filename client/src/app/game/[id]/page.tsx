"use client";

import { useParams, useRouter } from "next/navigation";
import { useGameStore } from "@/store/game-store";
import PlacementView from "@/components/placement/PlacementView";
import BattleView from "@/components/battle/BattleView";
import GameOverView from "@/components/game-over/GameOverView";

export default function GamePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const game = useGameStore((s) => s.game);

  if (!game || game.id !== params.id) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-slate-400">Game not found.</p>
        <button
          onClick={() => router.push("/")}
          className="rounded-lg bg-blue-600 px-6 py-2 font-semibold transition-colors hover:bg-blue-500"
        >
          Back to Menu
        </button>
      </div>
    );
  }

  if (game.phase === "placing_ships") return <PlacementView />;
  if (game.phase === "in_progress") return <BattleView />;
  return <GameOverView />;
}
