"use client";

import { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGameStore } from "@/store/game-store";
import { getSocket } from "@/lib/socket";
import PlacementView from "@/components/placement/PlacementView";
import BattleView from "@/components/battle/BattleView";
import GameOverView from "@/components/game-over/GameOverView";

export default function GamePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const gameId = useGameStore((s) => s.gameId);
  const gameStatus = useGameStore((s) => s.gameStatus);
  const waitingForOpponent = useGameStore((s) => s.waitingForOpponent);
  const gameCode = useGameStore((s) => s.gameCode);
  const connected = useGameStore((s) => s.connected);
  const initSession = useGameStore((s) => s.initSession);
  const attemptedReconnect = useRef(false);

  // Attempt reconnection if we land on a game page without store state
  useEffect(() => {
    if (attemptedReconnect.current) return;
    if (gameId === params.id) return; // already have the game

    attemptedReconnect.current = true;

    async function tryReconnect() {
      if (!connected) {
        await initSession();
      }
      // Give socket a tick to connect
      setTimeout(() => {
        const socket = getSocket();
        if (socket.connected) {
          socket.emit("reconnect_game", { gameId: params.id });
        }
      }, 500);
    }
    tryReconnect();
  }, [gameId, params.id, connected, initSession]);

  if (!gameId || gameId !== params.id) {
    if (!attemptedReconnect.current || !connected) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-slate-400 animate-pulse">Reconnecting...</p>
        </div>
      );
    }
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

  if (gameStatus === "waiting") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <h2 className="text-2xl font-bold">Waiting for Opponent</h2>
        {gameCode && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-slate-400">Share this code:</p>
            <p className="text-5xl font-mono font-bold tracking-widest text-blue-400">
              {gameCode}
            </p>
          </div>
        )}
        <p className="text-slate-500 animate-pulse">Waiting for someone to join...</p>
      </div>
    );
  }

  if (gameStatus === "placing_ships" && waitingForOpponent) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <h2 className="text-2xl font-bold">Ships Placed</h2>
        <p className="text-slate-500 animate-pulse">Waiting for opponent to place their ships...</p>
      </div>
    );
  }

  if (gameStatus === "placing_ships") return <PlacementView />;
  if (gameStatus === "in_progress") return <BattleView />;
  if (gameStatus === "completed") return <GameOverView />;

  return null;
}
