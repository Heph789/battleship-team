"use client";

import type { CellState } from "@battleship/shared";

const CELL_STYLES: Record<CellState, string> = {
  empty: "bg-slate-700 hover:bg-slate-600",
  ship: "bg-slate-500",
  hit: "bg-red-600",
  miss: "bg-slate-700",
  sunk: "bg-red-900",
};

type CellProps = {
  state: CellState;
  isGhost?: boolean;
  isInvalid?: boolean;
  interactive?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
};

export default function Cell({
  state,
  isGhost,
  isInvalid,
  interactive,
  onClick,
  onMouseEnter,
}: CellProps) {
  let className =
    "w-9 h-9 border border-slate-600 flex items-center justify-center text-xs font-bold transition-colors";

  if (isGhost) {
    className += isInvalid ? " bg-red-400/50" : " bg-green-400/50";
  } else {
    className += ` ${CELL_STYLES[state]}`;
  }

  if (interactive && state === "empty") {
    className += " cursor-crosshair";
  }

  return (
    <div className={className} onClick={onClick} onMouseEnter={onMouseEnter}>
      {state === "hit" && "✕"}
      {state === "sunk" && "✕"}
      {state === "miss" && (
        <span className="w-2 h-2 rounded-full bg-slate-400" />
      )}
    </div>
  );
}
