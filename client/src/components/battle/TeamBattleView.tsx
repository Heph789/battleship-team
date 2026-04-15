"use client";

import { buildCellGrid, SHIP_LABELS, type ShipType } from "@battleship/shared";
import { useGameStore } from "@/store/game-store";
import Board from "@/components/board/Board";

export default function TeamBattleView() {
  const teamBoard = useGameStore((s) => s.teamBoard);
  const enemyTeamBoard = useGameStore((s) => s.enemyTeamBoard);
  const fireShot = useGameStore((s) => s.fireShot);
  const isYourTurn = useGameStore((s) => s.isYourTurn);
  const isOpponentThinking = useGameStore((s) => s.isOpponentThinking);
  const shotMessage = useGameStore((s) => s.shotMessage);
  const yourScore = useGameStore((s) => s.yourScore);
  const yourPointValues = useGameStore((s) => s.yourPointValues);
  const turnOrder = useGameStore((s) => s.turnOrder);
  const currentTurn = useGameStore((s) => s.currentTurn);
  const userId = useGameStore((s) => s.userId);
  const teamId = useGameStore((s) => s.teamId);
  const teams = useGameStore((s) => s.teams);

  const teamGrid = buildCellGrid(teamBoard, true);
  const enemyGrid = buildCellGrid(enemyTeamBoard, false);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      {/* Turn order indicator */}
      {turnOrder && (
        <div className="flex gap-2 items-center">
          {turnOrder.map((playerId, i) => {
            const isCurrent = playerId === currentTurn;
            const isMe = playerId === userId;
            const playerTeam =
              teams?.teamA.playerIds.includes(playerId) ? "A" : "B";
            return (
              <div
                key={playerId}
                className={`px-3 py-1 rounded text-xs font-medium ${
                  isCurrent
                    ? "bg-amber-600 text-white"
                    : "bg-slate-700 text-slate-400"
                }`}
              >
                {isMe ? "You" : `T${playerTeam}`}
                {isCurrent && " \u25C0"}
              </div>
            );
          })}
        </div>
      )}

      {/* Status message */}
      <div className="h-8 text-center">
        {isOpponentThinking && !isYourTurn ? (
          <p className="text-yellow-400 font-medium animate-pulse">
            Waiting for other players...
          </p>
        ) : (
          shotMessage && (
            <p className="text-slate-200 font-medium">{shotMessage}</p>
          )
        )}
      </div>

      <div className="flex gap-12 items-start">
        {/* Your team's board */}
        <div className="flex flex-col items-center gap-2">
          <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide">
            Your Team&apos;s Fleet
          </h3>
          <Board grid={teamGrid} />
        </div>

        {/* Enemy team's board */}
        <div className="flex flex-col items-center gap-2">
          <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wide">
            Enemy Fleet
          </h3>
          <Board
            grid={enemyGrid}
            interactive={isYourTurn && !isOpponentThinking}
            onCellClick={(coord) => fireShot(coord)}
          />
        </div>

        {/* Score & point values sidebar */}
        <div className="flex flex-col gap-4 min-w-[140px]">
          <div className="rounded-lg bg-slate-800 p-3">
            <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">
              Your Score
            </h4>
            <p className="text-2xl font-bold text-amber-400">{yourScore}</p>
          </div>

          {yourPointValues && (
            <div className="rounded-lg bg-slate-800 p-3">
              <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">
                Point Values
              </h4>
              <div className="flex flex-col gap-1">
                {(Object.entries(yourPointValues) as [ShipType, number][]).map(
                  ([ship, value]) => (
                    <div
                      key={ship}
                      className="flex justify-between text-xs"
                    >
                      <span className="text-slate-300">
                        {SHIP_LABELS[ship]}
                      </span>
                      <span className="text-amber-400 font-medium">
                        {value}pt
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
