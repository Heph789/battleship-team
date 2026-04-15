import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@battleship/shared";

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";

let socket: TypedSocket | null = null;

export function getSocket(): TypedSocket {
  if (!socket) {
    const token = getSessionToken();
    socket = io(SERVER_URL, {
      withCredentials: true,
      auth: { token },
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(): TypedSocket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Session token management (stored in localStorage for simplicity)
const SESSION_KEY = "battleship_session";

export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_KEY);
}

export function setSessionToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, token);
}
