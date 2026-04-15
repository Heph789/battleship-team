"use client";

import { useEffect } from "react";
import {
  BOARD_SIZE,
  SHIP_TYPES,
  SHIP_LABELS,
  SHIP_LENGTHS,
  type Coordinate,
  type CellState,
  type ShipPlacement,
  getShipCells,
  validatePlacement,
} from "@battleship/shared";
import { useGameStore } from "@/store/game-store";
import Board from "@/components/board/Board";

export default function TeamPlacementView() {
  const placementShips = useGameStore((s) => s.placementShips);
  const activeShipType = useGameStore((s) => s.activeShipType);
  const activeOrientation = useGameStore((s) => s.activeOrientation);
  const hoverCell = useGameStore((s) => s.hoverCell);
  const setHoverCell = useGameStore((s) => s.setHoverCell);
  const setActiveShip = useGameStore((s) => s.setActiveShip);
  const rotateShip = useGameStore((s) => s.rotateShip);
  const teamPlaceShip = useGameStore((s) => s.teamPlaceShip);
  const teamRemoveShip = useGameStore((s) => s.teamRemoveShip);
  const teamLockIn = useGameStore((s) => s.teamLockIn);
  const teammateReady = useGameStore((s) => s.teammateReady);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "r" || e.key === "R") {
        rotateShip();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rotateShip]);

  // Build grid from placed ships
  const grid: CellState[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => "empty"),
  );
  for (const ship of placementShips) {
    for (const c of getShipCells(ship)) {
      grid[c.y][c.x] = "ship";
    }
  }

  // Ghost preview
  let ghostCells: Coordinate[] = [];
  let invalidGhost = false;
  if (activeShipType && hoverCell) {
    const candidate: ShipPlacement = {
      type: activeShipType,
      startX: hoverCell.x,
      startY: hoverCell.y,
      orientation: activeOrientation,
    };
    ghostCells = getShipCells(candidate);
    const others = placementShips.filter((s) => s.type !== activeShipType);
    invalidGhost = !validatePlacement(candidate, others);
  }

  const placedTypes = new Set(placementShips.map((s) => s.type));
  const allPlaced = placementShips.length === SHIP_TYPES.length;

  return (
    <div className="flex flex-1 items-center justify-center gap-10">
      <Board
        grid={grid}
        interactive={!!activeShipType}
        ghostCells={ghostCells}
        invalidGhost={invalidGhost}
        onCellClick={(coord) => teamPlaceShip(coord)}
        onCellHover={(coord) => setHoverCell(coord)}
        onMouseLeave={() => setHoverCell(null)}
      />

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Team Ship Placement</h2>
        <p className="text-sm text-slate-400">
          Place ships with your teammate. Both players see placements in real time.
        </p>

        <div className="flex flex-col gap-2">
          {SHIP_TYPES.map((type) => {
            const isPlaced = placedTypes.has(type);
            const isActive = activeShipType === type;
            return (
              <button
                key={type}
                onClick={() =>
                  isPlaced ? teamRemoveShip(type) : setActiveShip(type)
                }
                className={`flex items-center justify-between px-3 py-2 rounded text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : isPlaced
                      ? "bg-green-800/50 text-green-300"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                <span>
                  {SHIP_LABELS[type]} ({SHIP_LENGTHS[type]})
                </span>
                {isPlaced && <span className="text-green-400">&#10003;</span>}
              </button>
            );
          })}
        </div>

        <button
          onClick={rotateShip}
          className="rounded bg-slate-700 px-3 py-2 text-sm font-medium hover:bg-slate-600 transition-colors"
        >
          Rotate (R) — {activeOrientation === "horizontal" ? "\u2192" : "\u2193"}
        </button>

        {teammateReady && (
          <p className="text-sm text-green-400">Teammate is locked in</p>
        )}

        <button
          onClick={teamLockIn}
          disabled={!allPlaced}
          className={`rounded px-4 py-2 text-sm font-semibold transition-colors ${
            allPlaced
              ? "bg-amber-600 hover:bg-amber-500 text-white"
              : "bg-slate-700 text-slate-500 cursor-not-allowed"
          }`}
        >
          {allPlaced
            ? "Lock In"
            : `Place all ships (${placementShips.length}/${SHIP_TYPES.length})`}
        </button>
      </div>
    </div>
  );
}
