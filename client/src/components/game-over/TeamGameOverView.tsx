"use client";

import { useRouter } from "next/navigation";
import { buildCellGrid } from "@battleship/shared";
import { useGameStore } from "@/store/game-store";
import Board from "@/components/board/Board";

export default function TeamGameOverView() {
  const router = useRouter();
  const userId = useGameStore((s) => s.userId);
  const teamId = useGameStore((s) => s.teamId);
  const winnerId = useGameStore((s) => s.winnerId); // this is winningTeam in team mode
  const teamBoard = useGameStore((s) => s.teamBoard);
  const myEnemyView = useGameStore((s) => s.myEnemyView);
  const gameOverHitCounts = useGameStore((s) => s.gameOverHitCounts);
  const mvp = useGameStore((s) => s.mvp);
  const teams = useGameStore((s) => s.teams);
  const returnToMenu = useGameStore((s) => s.returnToMenu);

  const teamWon = winnerId === teamId;

  const teamGrid = buildCellGrid(teamBoard, true);
  const enemyGrid = buildCellGrid(myEnemyView, true);

  function handleMenu() {
    returnToMenu();
    router.push("/");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <h2
        className={`text-4xl font-bold ${teamWon ? "text-green-400" : "text-red-400"}`}
      >
        {teamWon ? "Victory!" : "Defeat!"}
      </h2>
      <p className="text-slate-400">
        {teamWon
          ? "Your team sunk all enemy ships!"
          : "The enemy team sunk all your ships!"}
      </p>

      {/* Hit count scoreboard */}
      {gameOverHitCounts && teams && (
        <div className="flex gap-8">
          {(["teamA", "teamB"] as const).map((tid) => (
            <div key={tid} className="flex flex-col items-center gap-2">
              <h3
                className={`font-semibold ${
                  tid === "teamA" ? "text-blue-400" : "text-red-400"
                }`}
              >
                {tid === "teamA" ? "Team A" : "Team B"}
                {tid === winnerId && " \u2605"}
              </h3>
              {teams[tid].playerIds.map((pid, i) => {
                const hits = gameOverHitCounts[pid] ?? 0;
                const isMvp = pid === mvp;
                const isMe = pid === userId;
                const name = teams[tid].displayNames[i] ?? pid.slice(0, 8);
                return (
                  <div
                    key={pid}
                    className={`flex items-center gap-2 text-sm ${
                      isMvp ? "text-amber-400 font-bold" : "text-slate-300"
                    }`}
                  >
                    <span>
                      {name}
                      {isMe && " (you)"}
                    </span>
                    <span className="font-mono">{hits} hits</span>
                    {isMvp && <span>MVP</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-12 items-start">
        <div className="flex flex-col items-center gap-2">
          <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide">
            Your Team&apos;s Fleet
          </h3>
          <Board grid={teamGrid} />
        </div>
        <div className="flex flex-col items-center gap-2">
          <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wide">
            Enemy Fleet
          </h3>
          <Board grid={enemyGrid} />
        </div>
      </div>

      <button
        onClick={handleMenu}
        className="rounded-lg border border-slate-600 px-6 py-2 font-semibold transition-colors hover:bg-slate-800"
      >
        Main Menu
      </button>
    </div>
  );
}
