/**
 * The workspace's bank connection. SIMULATED: there is no real bank integration yet; credits arrive through
 * `POST /api/bank/vietcombank` (secured by BANK_WEBHOOK_SECRET) and are always stored with origin "simulated".
 * Pure constants (safe to import on the client for the connection card).
 */
export const BANK_CONNECTION = {
  key: "vietcombank",
  name: "Vietcombank",
  account: "•••• 6789 · SPA HOA MAI",
  simulated: true,
} as const;

/** The stored channel event id of a credit from this connection: `vietcombank:<bank event id>`. */
export const bankEventId = (eventId: string) => `${BANK_CONNECTION.key}:${eventId}`;

/** The connection a stored inbound event came from (by its event id prefix), or null. */
export const bankConnectionOf = (ev: { channel?: string | null; event_id?: string | null } | null | undefined) =>
  ev?.channel === "bank" && ev.event_id?.startsWith(`${BANK_CONNECTION.key}:`) ? BANK_CONNECTION : null;

const compact = (s: string) => s.normalize("NFKD").toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Whether a bank transfer content names this exact code. Banks often drop dashes and spaces ("INV2026090021"), so both are
 * compared without separators; a longer number that merely starts with the code ("…00211") does not count.
 */
export const mentionsCode = (content: string | null | undefined, code: string | null | undefined): boolean => {
  const text = compact(content ?? "");
  const want = compact(code ?? "");
  if (!want) return false;
  for (let i = text.indexOf(want); i >= 0; i = text.indexOf(want, i + 1)) {
    const next = text[i + want.length];
    if (next === undefined || !/[0-9]/.test(next)) return true;
  }
  return false;
};
