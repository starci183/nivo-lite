import "server-only";
import { ingestBankCredit } from "./bank-feed";
import { boundAgent } from "./channels";
import { supabaseAdmin } from "./supabase/admin";

/**
 * What every bank/payment webhook does once it has authenticated a credit for a connection:
 *  1. remember that the connection works (pending -> connected, last_event_at, the first event) - this is what the wizard waits for,
 *     and it happens even when no agent is bound yet;
 *  2. feed the credit to the Accounting agent bound to the connection (same reconcile pipeline for every provider). A credit on a
 *     TEST connection is stored with origin "simulated" so accounting never treats it as real money.
 * Idempotency is the inbound `eventId` (`<provider>:<the provider's own id>`).
 */
export type Credit = { amount: number; content: string; eventId: string; fallbackBankName: string };
export type FeedResult = { ignored?: "no_agent"; duplicate?: boolean };

export const feedCredit = async (connectionId: string, workspaceId: string, credit: Credit): Promise<FeedResult> => {
  const db = supabaseAdmin();
  const { data: c } = await db.from("connections").select("name, environment, status, first_event").eq("id", connectionId).maybeSingle<{ name: string; environment: "test" | "live"; status: string; first_event: unknown }>();
  const at = new Date().toISOString();
  await db.from("connections").update({
    last_event_at: at,
    last_error: null,
    updated_at: at,
    ...(c?.status === "pending" || c?.status === "error" ? { status: "connected" } : {}),
    ...(c?.first_event ? {} : { first_event: { amount: Math.round(credit.amount), content: credit.content, at } }),
  }).eq("id", connectionId);

  const agent = await boundAgent(connectionId, "accounting", ["bank_feed"]).catch(() => null);
  if (!agent) return { ignored: "no_agent" };
  const result = await ingestBankCredit(db, workspaceId, {
    amount: credit.amount, content: credit.content, sender: null, eventId: credit.eventId,
    bankName: c?.name ?? credit.fallbackBankName, origin: c?.environment === "test" ? "simulated" : "live",
  });
  return { duplicate: result.duplicate };
};
