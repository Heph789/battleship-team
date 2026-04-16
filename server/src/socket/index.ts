import { Server as SocketServer } from "socket.io";
import type http from "node:http";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@battleship/shared";
import { getUserByToken } from "../auth/session.js";
import { registerLobbyHandlers } from "./lobby.js";
import { registerPlacementHandlers } from "./placement.js";
import { registerFiringHandlers } from "./firing.js";
import { registerRematchHandlers } from "./rematch.js";
import { registerTeamLobbyHandlers } from "./team-lobby.js";
import { registerTeamPlacementHandlers } from "./team-placement.js";
import { registerTeamFiringHandlers } from "./team-firing.js";

export type TypedServer = SocketServer<
  ClientToServerEvents,
  ServerToClientEvents
>;
export type TypedSocket = Parameters<
  Parameters<TypedServer["on"]>[1]
>[0] & { data: { userId: string; gameId?: string } };

export function createSocketServer(
  httpServer: http.Server,
  clientOrigin: string,
) {
  const io: TypedServer = new SocketServer(httpServer, {
    cors: { origin: clientOrigin },
  });

  // Auth middleware: extract userId from token
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error("No session token"));
    }
    const user = getUserByToken(token);
    if (!user) {
      return next(new Error("Invalid session token"));
    }
    socket.data = { userId: user.id };
    next();
  });

  io.on("connection", (socket) => {
    const s = socket as unknown as TypedSocket;
    registerLobbyHandlers(io, s);
    registerPlacementHandlers(io, s);
    registerFiringHandlers(io, s);
    registerRematchHandlers(io, s);
    registerTeamLobbyHandlers(io, s);
    registerTeamPlacementHandlers(io, s);
    registerTeamFiringHandlers(io, s);
  });

  return io;
}
