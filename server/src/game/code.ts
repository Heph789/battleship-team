import { findGameByCode } from "../db/index.js";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 for readability

export function generateCode(): string {
  let code: string;
  do {
    code = Array.from({ length: 4 }, () =>
      CHARS[Math.floor(Math.random() * CHARS.length)],
    ).join("");
  } while (lookupByCode(code)); // ensure unique
  return code;
}

export function lookupByCode(code: string) {
  return findGameByCode(code);
}
