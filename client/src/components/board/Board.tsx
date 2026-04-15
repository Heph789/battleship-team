"use client";

import { BOARD_SIZE, type CellState, type Coordinate } from "@battleship/shared";
import Cell from "./Cell";

const COL_LABELS = "ABCDEFGHIJ".split("");

type BoardProps = {
  grid: CellState[][];
  interactive?: boolean;
  ghostCells?: Coordinate[];
  invalidGhost?: boolean;
  wastedCells?: Coordinate[];
  onCellClick?: (coord: Coordinate) => void;
  onCellHover?: (coord: Coordinate) => void;
  onMouseLeave?: () => void;
};

export default function Board({
  grid,
  interactive = false,
  ghostCells,
  invalidGhost,
  wastedCells,
  onCellClick,
  onCellHover,
  onMouseLeave,
}: BoardProps) {
  const ghostSet = new Set(
    (ghostCells ?? []).map((c) => `${c.x},${c.y}`),
  );
  const wastedSet = new Set(
    (wastedCells ?? []).map((c) => `${c.x},${c.y}`),
  );

  return (
    <div className="inline-block" onMouseLeave={onMouseLeave}>
      {/* Column headers */}
      <div className="flex">
        <div className="w-9 h-7" /> {/* corner spacer */}
        {COL_LABELS.map((label) => (
          <div
            key={label}
            className="w-9 h-7 flex items-center justify-center text-xs text-slate-400 font-mono"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Grid rows */}
      {Array.from({ length: BOARD_SIZE }, (_, y) => (
        <div key={y} className="flex">
          {/* Row label */}
          <div className="w-9 h-9 flex items-center justify-center text-xs text-slate-400 font-mono">
            {y + 1}
          </div>
          {Array.from({ length: BOARD_SIZE }, (_, x) => {
            const isGhost = ghostSet.has(`${x},${y}`);
            const isWasted = wastedSet.has(`${x},${y}`);
            return (
              <Cell
                key={`${x},${y}`}
                state={grid[y][x]}
                isGhost={isGhost}
                isInvalid={isGhost && invalidGhost}
                isWasted={isWasted}
                interactive={interactive}
                onClick={() => onCellClick?.({ x, y })}
                onMouseEnter={() => onCellHover?.({ x, y })}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
