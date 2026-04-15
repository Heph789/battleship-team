"use client";

import {
  SHIP_TYPES,
  SHIP_LABELS,
  SHIP_LENGTHS,
  type ShipType,
} from "@battleship/shared";
import { useGameStore } from "@/store/game-store";

export default function ShipSelector() {
  const placementShips = useGameStore((s) => s.placementShips);
  const activeShipType = useGameStore((s) => s.activeShipType);
  const activeOrientation = useGameStore((s) => s.activeOrientation);
  const setActiveShip = useGameStore((s) => s.setActiveShip);
  const removeShip = useGameStore((s) => s.removeShip);
  const rotateShip = useGameStore((s) => s.rotateShip);
  const confirmPlacement = useGameStore((s) => s.confirmPlacement);

  const placedTypes = new Set(placementShips.map((s) => s.type));
  const allPlaced = placementShips.length === SHIP_TYPES.length;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Place Your Ships</h2>
      <div className="flex flex-col gap-2">
        {SHIP_TYPES.map((type) => {
          const isPlaced = placedTypes.has(type);
          const isActive = activeShipType === type;
          return (
            <button
              key={type}
              onClick={() => (isPlaced ? removeShip(type) : setActiveShip(type))}
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

      <div className="flex gap-2">
        <button
          onClick={rotateShip}
          className="flex-1 rounded bg-slate-700 px-3 py-2 text-sm font-medium hover:bg-slate-600 transition-colors"
        >
          Rotate (R) — {activeOrientation === "horizontal" ? "→" : "↓"}
        </button>
      </div>

      <button
        onClick={confirmPlacement}
        disabled={!allPlaced}
        className={`rounded px-4 py-2 text-sm font-semibold transition-colors ${
          allPlaced
            ? "bg-green-600 hover:bg-green-500 text-white"
            : "bg-slate-700 text-slate-500 cursor-not-allowed"
        }`}
      >
        {allPlaced ? "Start Battle!" : `Place all ships (${placementShips.length}/${SHIP_TYPES.length})`}
      </button>
    </div>
  );
}
