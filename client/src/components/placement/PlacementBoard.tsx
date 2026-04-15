"use client";

import {
  BOARD_SIZE,
  type Coordinate,
  type CellState,
  type ShipPlacement,
  getShipCells,
  validatePlacement,
} from "@battleship/shared";
import { useGameStore } from "@/store/game-store";
import Board from "@/components/board/Board";

export default function PlacementBoard() {
  const placementShips = useGameStore((s) => s.placementShips);
  const activeShipType = useGameStore((s) => s.activeShipType);
  const activeOrientation = useGameStore((s) => s.activeOrientation);
  const hoverCell = useGameStore((s) => s.hoverCell);
  const setHoverCell = useGameStore((s) => s.setHoverCell);
  const placeShip = useGameStore((s) => s.placeShip);

  // Build grid from placed ships
  const grid: CellState[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => "empty"),
  );
  for (const ship of placementShips) {
    for (const c of getShipCells(ship)) {
      grid[c.y][c.x] = "ship";
    }
  }

  // Compute ghost preview
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

  return (
    <Board
      grid={grid}
      interactive={!!activeShipType}
      ghostCells={ghostCells}
      invalidGhost={invalidGhost}
      onCellClick={(coord) => placeShip(coord)}
      onCellHover={(coord) => setHoverCell(coord)}
      onMouseLeave={() => setHoverCell(null)}
    />
  );
}
