"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/game-store";

export default function Home() {
  const router = useRouter();
  const initSession = useGameStore((s) => s.initSession);
  const connected = useGameStore((s) => s.connected);
  const createGame = useGameStore((s) => s.createGame);
  const joinGame = useGameStore((s) => s.joinGame);
  const joinTeamGame = useGameStore((s) => s.joinTeamGame);
  const gameId = useGameStore((s) => s.gameId);
  const errorMessage = useGameStore((s) => s.errorMessage);

  const [joinCode, setJoinCode] = useState("");
  const [showJoin, setShowJoin] = useState<false | "multiplayer" | "team">(false);
  const [showTeamRules, setShowTeamRules] = useState<false | "create" | "join">(false);

  useEffect(() => {
    initSession();
  }, [initSession]);

  // Navigate when a game is created/joined
  useEffect(() => {
    if (gameId) {
      router.push(`/game/${gameId}`);
    }
  }, [gameId, router]);

  function handlePlayAI() {
    createGame("ai");
  }

  function handleCreateMultiplayer() {
    createGame("multiplayer");
  }

  function handleCreateTeam() {
    createGame("team");
  }

  function handleJoin() {
    if (joinCode.trim().length !== 4) return;
    if (showJoin === "team") {
      joinTeamGame(joinCode.trim());
    } else {
      joinGame(joinCode.trim());
    }
  }

  if (!connected) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-slate-400 animate-pulse">Connecting...</p>
      </div>
    );
  }

  if (showTeamRules) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
        <h1 className="text-4xl font-bold tracking-tight">2v2 Team Battleship</h1>
        <div className="max-w-lg flex flex-col gap-4 text-slate-300 text-sm leading-relaxed">
          <div className="rounded-lg bg-slate-800 p-4 flex flex-col gap-3">
            <h2 className="text-base font-semibold text-white">How it works</h2>
            <p>
              Two teams of two. Each team shares one fleet of ships and takes turns
              firing at the enemy fleet.
            </p>
          </div>

          <div className="rounded-lg bg-slate-800 p-4 flex flex-col gap-3">
            <h2 className="text-base font-semibold text-white">Placement</h2>
            <p>
              Teammates collaborate to place ships on a shared board. Both players
              can place and rearrange ships until both lock in.
            </p>
          </div>

          <div className="rounded-lg bg-slate-800 p-4 flex flex-col gap-3">
            <h2 className="text-base font-semibold text-white">Firing</h2>
            <p>
              On your team&apos;s turn, both teammates fire simultaneously and
              independently. You don&apos;t see where your teammate is aiming.
            </p>
          </div>

          <div className="rounded-lg bg-slate-800 p-4 flex flex-col gap-3">
            <h2 className="text-base font-semibold text-white">Private views</h2>
            <p>
              Each player has their own view of the enemy board. You only see your
              own hits and misses — unless your teammate shares theirs.
            </p>
          </div>

          <div className="rounded-lg bg-slate-800 p-4 flex flex-col gap-3">
            <h2 className="text-base font-semibold text-white">Share or keep</h2>
            <p>
              After a hit, you choose: share the result with your teammate (they see
              it on their board) or keep it secret. Sharing helps coordination but
              reveals your advantage.
            </p>
          </div>

          <div className="rounded-lg bg-slate-800 p-4 flex flex-col gap-3">
            <h2 className="text-base font-semibold text-white">Wasted shots</h2>
            <p>
              If you fire at a cell your teammate already hit (and didn&apos;t share),
              your shot is wasted. Coordination matters.
            </p>
          </div>

          <div className="rounded-lg bg-slate-800 p-4 flex flex-col gap-3">
            <h2 className="text-base font-semibold text-white">Winning</h2>
            <p>
              The game ends when all ships on one side are sunk. The MVP is the
              player with the most hits on the winning team.
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-2">
          <button
            onClick={() => setShowTeamRules(false)}
            className="rounded-lg border border-slate-600 px-6 py-2.5 font-semibold transition-colors hover:bg-slate-800"
          >
            Back
          </button>
          <button
            onClick={() => {
              if (showTeamRules === "create") {
                handleCreateTeam();
              } else {
                setShowTeamRules(false);
                setShowJoin("team");
              }
            }}
            className="rounded-lg bg-amber-600 px-6 py-2.5 font-semibold transition-colors hover:bg-amber-500"
          >
            {showTeamRules === "create" ? "Create Game" : "Enter Code"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8">
      <h1 className="text-6xl font-bold tracking-tight">Battleship</h1>
      <p className="text-lg text-slate-400">A classic game of naval strategy</p>

      {errorMessage && (
        <p className="text-red-400 text-sm">{errorMessage}</p>
      )}

      <div className="flex flex-col gap-3 w-64">
        <button
          onClick={handlePlayAI}
          className="rounded-lg bg-blue-600 px-8 py-3 text-lg font-semibold transition-colors hover:bg-blue-500"
        >
          Play vs AI
        </button>

        <button
          onClick={handleCreateMultiplayer}
          className="rounded-lg bg-purple-600 px-8 py-3 text-lg font-semibold transition-colors hover:bg-purple-500"
        >
          Create 1v1 Game
        </button>

        <button
          onClick={() => setShowTeamRules("create")}
          className="rounded-lg bg-amber-600 px-8 py-3 text-lg font-semibold transition-colors hover:bg-amber-500"
        >
          Create 2v2 Team Game
        </button>

        {!showJoin ? (
          <div className="flex gap-2">
            <button
              onClick={() => setShowJoin("multiplayer")}
              className="flex-1 rounded-lg border border-slate-600 px-4 py-3 text-lg font-semibold transition-colors hover:bg-slate-800"
            >
              Join 1v1
            </button>
            <button
              onClick={() => setShowTeamRules("join")}
              className="flex-1 rounded-lg border border-amber-600 px-4 py-3 text-lg font-semibold transition-colors hover:bg-slate-800 text-amber-400"
            >
              Join 2v2
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              placeholder="CODE"
              className="flex-1 rounded-lg bg-slate-800 border border-slate-600 px-4 py-3 text-center text-lg font-mono tracking-widest uppercase focus:outline-none focus:border-blue-500"
              maxLength={4}
              autoFocus
            />
            <button
              onClick={handleJoin}
              disabled={joinCode.trim().length !== 4}
              className="rounded-lg bg-green-600 px-4 py-3 font-semibold transition-colors hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Go
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
