"use client";

import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/game-store";

export default function Home() {
  const router = useRouter();
  const startNewGame = useGameStore((s) => s.startNewGame);

  function handlePlayAI() {
    const id = startNewGame();
    router.push(`/game/${id}`);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8">
      <h1 className="text-6xl font-bold tracking-tight">Battleship</h1>
      <p className="text-lg text-slate-400">A classic game of naval strategy</p>
      <div className="flex flex-col gap-3">
        <button
          onClick={handlePlayAI}
          className="rounded-lg bg-blue-600 px-8 py-3 text-lg font-semibold transition-colors hover:bg-blue-500"
        >
          Play vs AI
        </button>
        <button
          disabled
          className="rounded-lg border border-slate-600 px-8 py-3 text-lg font-semibold text-slate-500 cursor-not-allowed"
        >
          Multiplayer (coming soon)
        </button>
      </div>
    </div>
  );
}
