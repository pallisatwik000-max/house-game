import { createHmac, randomBytes, timingSafeEqual } from "crypto";

function secret(): string {
  const s = process.env.PIN_SECRET;
  if (!s) throw new Error("PIN_SECRET is not set");
  return s;
}

// Short random id used in the player join link
export function generateSlug(): string {
  return randomBytes(5).toString("hex");
}

// 6-digit PIN derived from the game slug + server secret.
// Players cannot guess it, and the Admin can see it again any time
// (even after a page refresh) without storing it in plain text.
export function derivePin(slug: string): string {
  const h = createHmac("sha256", secret()).update(`pin:${slug}`).digest();
  const n = h.readUInt32BE(0) % 1000000;
  return String(n).padStart(6, "0");
}

// What we store in the database (never the plain PIN)
export function hashPin(pin: string, slug: string): string {
  return createHmac("sha256", secret()).update(`${slug}:${pin}`).digest("hex");
}

// Constant-time PIN check
export function verifyPin(pin: string, slug: string, storedHash: string): boolean {
  const a = Buffer.from(hashPin(pin, slug), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
