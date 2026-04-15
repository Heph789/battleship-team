import { eq } from "drizzle-orm";
import {
  SHIP_TYPES,
  validatePlacement,
  type ServerGameState,
  type ShipPlacement,
} from "@battleship/shared";
import type { TypedServer, TypedSocket } from "./index.js";
import { db, schema, findGame } from "../db/index.js";
import { setPlayerShips, allPlayersReady } from "../game/state.js";

export function registerPlacementHandlers(
  io: TypedServer,
  socket: TypedSocket,
) {
  const userId = socket.data.userId;

  socket.on("place_ships", (data: { ships: ShipPlacement[] }) => {
    const gameId = socket.data.gameId;
    if (!gameId) {
      socket.emit("error", { message: "Not in a game" });
      return;
    }

    const gameRow = findGame(gameId);
    if (!gameRow || gameRow.status !== "placing_ships") {
      socket.emit("error", { message: "Cannot place ships now" });
      return;
    }

    if (!validateShipSet(data.ships)) {
      socket.emit("error", { message: "Invalid ship placements" });
      return;
    }

    let state = gameRow.state as unknown as ServerGameState;
    state = setPlayerShips(state, userId, data.ships);

    const ready = allPlayersReady(state);

    db.update(schema.game)
      .set({
        status: ready ? "in_progress" : "placing_ships",
        state: state as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(schema.game.id, gameId))
      .run();

    socket.emit("ships_accepted");

    if (ready) {
      io.to(gameId).emit("both_ready", { currentTurn: state.currentTurn });
    }
  });
}

function validateShipSet(ships: ShipPlacement[]): boolean {
  if (ships.length !== SHIP_TYPES.length) return false;

  const types = new Set(ships.map((s) => s.type));
  if (types.size !== SHIP_TYPES.length) return false;
  for (const t of SHIP_TYPES) {
    if (!types.has(t)) return false;
  }

  const placed: ShipPlacement[] = [];
  for (const ship of ships) {
    if (!validatePlacement(ship, placed)) return false;
    placed.push(ship);
  }
  return true;
}
