"use client";

import { useEffect } from "react";
import { useGameStore } from "@/store/game-store";
import PlacementBoard from "./PlacementBoard";
import ShipSelector from "./ShipSelector";

export default function PlacementView() {
  const rotateShip = useGameStore((s) => s.rotateShip);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "r" || e.key === "R") {
        rotateShip();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rotateShip]);

  return (
    <div className="flex flex-1 items-center justify-center gap-10">
      <PlacementBoard />
      <ShipSelector />
    </div>
  );
}
