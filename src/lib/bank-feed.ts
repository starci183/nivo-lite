import "server-only";
import { revalidatePath } from "next/cache";
import { translator } from "@/i18n/core";
import { system } from "@/i18n/dict/system";
import { ingest, type Db } from "./core";
import { startInboundWork, type EngineCtx } from "./engine";
import { drainAfter } from "./flow-ctx";

/**
 * One bank credit becomes a bank payment input and runs the normal reconcile_payment work (the same pipeline for the simulated
 * Vietcombank route and for a workspace's own SePay feed). A credit whose content names exactly one open payment record code
 * with the same amount completes by policy (below the limit); anything else waits for the owner's check with a written basis.
 * Idempotency: `eventId` (the bank's own transaction id) is the inbound key; the same credit sent again is recorded once.
 */
export type BankCredit = { amount: number; content: string; sender: string | null; eventId: string; bankName: string; origin: "live" | "simulated" };

export const ingestBankCredit = async (db: Db, ws: string, credit: BankCredit) => {
  const locale = "vi" as const;
  const c: EngineCtx = { db, ws, actor: credit.bankName, locale };
  const t = translator(system, locale);
  const amount = Math.round(credit.amount);
  const { event, duplicate } = await ingest(db, ws, {
    channel: "bank", kind: "payment", origin: credit.origin, sender_name: credit.sender, sender_contact: null,
    body: t("bankEventBody", { bank: credit.bankName, content: credit.content || "—" }), amount_vnd: amount,
    external_ref: credit.content || null, event_id: credit.eventId,
  }, (n) => t("duplicateBlocked", { n }));
  if (duplicate) return { duplicate: true as const, event };
  const item = await startInboundWork(c, event, "reconcile_payment", { amount_vnd: amount, fields: {} });
  // The chain (care message to the customer) runs after the response, like every other flow step.
  drainAfter(c);
  try {
    revalidatePath("/", "layout");
  } catch {
    // Outside a request scope (scripts): nothing to revalidate.
  }
  return { duplicate: false as const, event, item };
};
