import { createHmac, timingSafeEqual } from "node:crypto";

/** hex HMAC-SHA256 over `<timestamp>.<raw body>`. The app verifies the same thing in src/lib/engine-queue.ts (verifyEngineRequest). */
export const signBody = (secret: string, timestamp: string, rawBody: string): string => createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");

/** Constant-time string comparison that never throws on a length mismatch. */
export const safeEqual = (a: string, b: string): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** A key derived from the shared secret for one purpose, so a leaked derived key never reveals the secret or the other keys. */
export const deriveKey = (secret: string, purpose: string): string => createHmac("sha256", secret).update(purpose).digest("hex");
