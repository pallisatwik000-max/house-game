import { randomInt } from "crypto";

export type Rows = number[][];
export type Category =
  | "FIRST_5"
  | "FIRST_LINE"
  | "SECOND_LINE"
  | "LAST_LINE"
  | "HOUSE_FULL";

export const CATEGORIES: Category[] = [
  "FIRST_5",
  "FIRST_LINE",
  "SECOND_LINE",
  "LAST_LINE",
  "HOUSE_FULL",
];

// ---------- Ticket generation ----------
// Tickets are generated from a seeded shuffle, so set N of a game can
// always be rebuilt exactly. Each set = 6 tickets that together use
// every number 1..90 exactly once. Each ticket = 3 rows x 5 numbers.

function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateTicketSet(gameId: string, setNo: number): Rows[] {
  const rand = mulberry32(hashSeed(`${gameId}:${setNo}`));
  const nums = Array.from({ length: 90 }, (_, i) => i + 1);
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  const tickets: Rows[] = [];
  for (let t = 0; t < 6; t++) {
    const chunk = nums.slice(t * 15, t * 15 + 15);
    const rows = [0, 1, 2].map((r) =>
      chunk.slice(r * 5, r * 5 + 5).sort((a, b) => a - b)
    );
    tickets.push(rows);
  }
  return tickets;
}

// ticketNo is 1-based and counted across the whole game.
export function ticketFor(gameId: string, ticketNo: number) {
  const setNo = Math.floor((ticketNo - 1) / 6) + 1;
  const pos = (ticketNo - 1) % 6;
  const rows = generateTicketSet(gameId, setNo)[pos];
  return { setNo, rows };
}

export function isValidTicket(rows: Rows): boolean {
  if (!Array.isArray(rows) || rows.length !== 3) return false;
  const all: number[] = [];
  for (const r of rows) {
    if (!Array.isArray(r) || r.length !== 5) return false;
    all.push(...r);
  }
  return (
    all.length === 15 &&
    new Set(all).size === 15 &&
    all.every((n) => Number.isInteger(n) && n >= 1 && n <= 90)
  );
}

// ---------- Number calling ----------

// Secure random pick from numbers not yet called. Returns null when all 90 are done.
export function pickNextNumber(called: number[]): number | null {
  const taken = new Set(called);
  const remaining: number[] = [];
  for (let n = 1; n <= 90; n++) if (!taken.has(n)) remaining.push(n);
  if (remaining.length === 0) return null;
  const n = remaining[randomInt(remaining.length)];
  // Validate before publishing
  if (!Number.isInteger(n) || n < 1 || n > 90 || taken.has(n)) return null;
  return n;
}

// ---------- Claim checking (always run on the server) ----------

export function checkClaim(
  category: Category,
  rows: Rows,
  marked: number[],
  called: number[]
): { valid: boolean; reason?: string } {
  const calledSet = new Set(called);
  const markedSet = new Set(marked);
  const ok = (n: number) => calledSet.has(n) && markedSet.has(n);
  const flat = rows.flat();

  switch (category) {
    case "FIRST_5": {
      // Must be claimed right after the 5th call, before the 6th number.
      if (called.length !== 5) {
        return { valid: false, reason: "FIRST 5 window is not open" };
      }
      const first5 = called.slice(0, 5);
      const good = first5.every((n) => flat.includes(n) && markedSet.has(n));
      return good ? { valid: true } : { valid: false, reason: "Not all first 5 marked" };
    }
    case "FIRST_LINE":
      return rows[0].every(ok)
        ? { valid: true }
        : { valid: false, reason: "First line incomplete" };
    case "SECOND_LINE":
      return rows[1].every(ok)
        ? { valid: true }
        : { valid: false, reason: "Second line incomplete" };
    case "LAST_LINE":
      return rows[2].every(ok)
        ? { valid: true }
        : { valid: false, reason: "Last line incomplete" };
    case "HOUSE_FULL":
      return flat.every(ok)
        ? { valid: true }
        : { valid: false, reason: "House full incomplete" };
    default:
      return { valid: false, reason: "Unknown category" };
  }
    }
