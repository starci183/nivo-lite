import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { engineSecret } from "./engine-queue";

/**
 * Authentication of the minute tick (POST /api/automation/tick): x-tick-signature = hex HMAC-SHA256(tickKey, x-tick-timestamp), within 5 minutes.
 * tickKey = hex HMAC-SHA256(ENGINE_SHARED_SECRET, "automation-tick"): the value stored in Supabase Vault as 'nivo_tick_key' (the shared secret itself never leaves the app).
 */
const SKEW_MS = 5 * 60_000;

export const tickKey = (secret: string): string => createHmac("sha256", secret).update("automation-tick").digest("hex");

export const verifyTick = (headers: Headers): boolean => {
  const secret = engineSecret();
  const timestamp = headers.get("x-tick-timestamp");
  const signature = headers.get("x-tick-signature");
  if (!secret || !timestamp || !signature) return false;
  const at = Number(timestamp);
  if (!Number.isFinite(at) || Math.abs(Date.now() - at) > SKEW_MS) return false;
  const expected = Buffer.from(createHmac("sha256", tickKey(secret)).update(timestamp).digest("hex"), "hex");
  const given = Buffer.from(signature, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
};
