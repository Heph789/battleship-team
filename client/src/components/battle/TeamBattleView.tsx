"use client";

import { buildCellGrid, SHIP_LABELS } from "@battleship/shared";
import { useGameStore } from "@/store/game-store";
import Board from "@/components/board/Board";

export default function TeamBattleView() {
  const teamBoard = useGameStore((s) => s.teamBoard);
  const myEnemyView = useGameStore((s) => s.myEnemyView);
  const teamFire = useGameStore((s) => s.teamFire);
  const teamShareDecision = useGameStore((s) => s.teamShareDecision);
  const isYourTurn = useGameStore((s) => s.isYourTurn);
  const shotMessage = useGameStore((s) => s.shotMessage);
  const hitCount = useGameStore((s) => s.hitCount);
  const currentTeamTurn = useGameStore((s) => s.currentTeamTurn);
  const teamId = useGameStore((s) => s.teamId);
  const sharePromptResult = useGameStore((s) => s.sharePromptResult);
  const waitingForTeammate = useGameStore((s) => s.waitingForTeammate);
  const wastedCells = useGameStore((s) => s.wastedCells);

  const teamGrid = buildCellGrid(teamBoard, true);
  const enemyGrid = buildCellGrid(myEnemyView, false);

  const canFire = isYourTurn && !waitingForTeammate && !sharePromptResult;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      {/* Team turn indicator */}
      <div className="flex gap-4 items-center">
        {(["teamA", "teamB"] as const).map((tid) => {
          const isCurrent = tid === currentTeamTurn;
          const isMyTeam = tid === teamId;
          return (
            <div
              key={tid}
              className={`px-4 py-1.5 rounded text-sm font-medium ${
                isCurrent
                  ? "bg-amber-600 text-white"
                  : "bg-slate-700 text-slate-400"
              }`}
            >
              {isMyTeam ? "Your Team" : "Enemy Team"}
              {isCurrent && " \u25C0"}
            </div>
          );
        })}
      </div>

      {/* Status message */}
      <div className="h-8 text-center">
        {waitingForTeammate ? (
          <p className="text-yellow-400 font-medium animate-pulse">
            Waiting for teammate to fire...
          </p>
        ) : (
          shotMessage && (
            <p className="text-slate-200 font-medium">{shotMessage}</p>
          )
        )}
      </div>

      {/* Share prompt overlay */}
      {sharePromptResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-800 rounded-xl p-6 flex flex-col items-center gap-4 shadow-2xl border border-slate-600">
            <h3 className="text-lg font-bold text-white">
              You {sharePromptResult.result === "sunk" ? "sunk" : "hit"} the{" "}
              {sharePromptResult.shipType
                ? SHIP_LABELS[sharePromptResult.shipType]
                : "enemy ship"}
              !
            </h3>
            <p className="text-slate-300 text-sm">
              Share this hit with your teammate?
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => teamShareDecision(true)}
                className="rounded-lg bg-green-600 px-6 py-2 font-semibold text-white hover:bg-green-500 transition-colors"
              >
                Share
              </button>
              <button
                onClick={() => teamShareDecision(false)}
                className="rounded-lg bg-slate-600 px-6 py-2 font-semibold text-white hover:bg-slate-500 transition-colors"
              >
                Keep Secret
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-12 items-start">
        {/* Your team's board */}
        <div className="flex flex-col items-center gap-2">
          <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide">
            Your Team&apos;s Fleet
          </h3>
          <Board grid={teamGrid} />
        </div>

        {/* Enemy board (your private view) */}
        <div className="flex flex-col items-center gap-2">
          <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wide">
            Enemy Fleet (Your View)
          </h3>
          <Board
            grid={enemyGrid}
            interactive={canFire}
            wastedCells={wastedCells}
            onCellClick={(coord) => teamFire(coord)}
          />
        </div>

        {/* Hit count sidebar */}
        <div className="flex flex-col gap-4 min-w-[140px]">
          <div className="rounded-lg bg-slate-800 p-3">
            <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">
              Your Hits
            </h4>
            <p className="text-2xl font-bold text-amber-400">{hitCount}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
