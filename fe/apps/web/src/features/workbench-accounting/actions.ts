"use server";

import { revalidatePath } from "next/cache";
import { translator } from "@/i18n/core";
import { workbenchAccounting } from "@/i18n/dict/workbenchAccounting";
import { logEvidence } from "@/lib/core";
import { engineCtx } from "@/lib/flow-ctx";
import { simulateInbound } from "@/lib/flow-actions";
import { requireManager } from "@/lib/permissions";
import type { Outcome } from "@/lib/types";

const run = async <T>(fn: () => Promise<T>): Promise<Outcome<T>> => {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

/** What the owner types in "Ghi nhận thủ công". */
export type ManualEvidenceInput = { amount: number; date: string; content: string; note: string; payer?: string };

/**
 * Admit one manual piece of evidence (money the owner knows arrived). It goes through the same inbound path as every other
 * input (idempotent ingest, then NIVO matches it to an invoice or asks), so it appears as a bank-credit row with its match
 * state. Like every manual input in this build it is labelled simulated. The date the owner gives becomes the payment date.
 */
export async function admitManualEvidence(input: ManualEvidenceInput): Promise<Outcome<{ duplicate: boolean; transactionId: string | null }>> {
  return run(async () => {
    const c = await engineCtx();
    const t = translator(workbenchAccounting, c.locale);
    const amount = Math.round(Number(input.amount));
    const content = input.content.trim();
    if (!Number.isFinite(amount) || amount <= 0) throw new Error(t("errAmount"));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error(t("errDate"));
    if (content.length < 3) throw new Error(t("errContent"));
    const res = await simulateInbound({
      channel: "manual", kind: "payment", sender_name: input.payer?.trim() ?? "", amount_vnd: amount, external_ref: content,
      body: [content, input.note.trim()].filter(Boolean).join(" — "),
    });
    if (!res.ok) throw new Error(res.error);
    const { event, duplicate } = res.data;
    let transactionId: string | null = null;
    if (!duplicate) {
      const when = new Date(`${input.date}T12:00:00+07:00`).toISOString();
      const upd = await c.db.from("transactions").update({ occurred_at: when }).eq("workspace_id", c.ws).eq("inbound_event_id", event.id).select("id").maybeSingle();
      transactionId = (upd.data as { id: string } | null)?.id ?? null;
      await logEvidence(c.db, c.ws, { kind: "accounting.manual_evidence", actor: c.actor, summary: t("evidenceLog", { amount, date: input.date }), evidence: [content, input.note.trim()].filter(Boolean).join(" — ") });
    }
    revalidatePath("/", "layout");
    return { duplicate, transactionId };
  });
}

/** An adjustment: a correction NOTE added next to an invoice or payment. The original row is never edited. */
export type AdjustmentInput = { targetType: "invoice" | "transaction"; targetId: string; note: string; correctedAmount?: number | null };

/** Owner or manager adds a correction. History is append-only: the note, who and when are kept, plus an event in the evidence log. */
export async function addAdjustment(input: AdjustmentInput): Promise<Outcome<{ id: string }>> {
  return run(async () => {
    const member = await requireManager();
    const c = await engineCtx();
    const t = translator(workbenchAccounting, c.locale);
    const note = input.note.trim().replace(/\s+/g, " ");
    if (note.length < 5) throw new Error(t("errAdjustNote"));
    const corrected = input.correctedAmount === null || input.correctedAmount === undefined ? null : Math.round(Number(input.correctedAmount));
    if (corrected !== null && (!Number.isFinite(corrected) || corrected < 0)) throw new Error(t("errAmount"));
    const table = input.targetType === "invoice" ? "invoices" : "transactions";
    const target = await c.db.from(table).select(input.targetType === "invoice" ? "id, lead_id" : "id").eq("id", input.targetId).eq("workspace_id", c.ws).maybeSingle();
    if (!target.data) throw new Error(t("errTarget"));
    const ins = await c.db.from("accounting_adjustments").insert({
      workspace_id: c.ws, target_type: input.targetType, target_id: input.targetId, note, corrected_amount_vnd: corrected, created_by: member.displayName,
    }).select("id").single();
    if (ins.error) throw new Error(ins.error.code === "42P01" || ins.error.code === "PGRST205" ? t("errNotReady") : ins.error.message);
    const leadId = (target.data as unknown as { lead_id?: string | null }).lead_id ?? null;
    await logEvidence(c.db, c.ws, {
      lead_id: leadId, kind: "accounting.adjustment", actor: member.displayName,
      summary: t(corrected === null ? "adjustLog" : "adjustLogAmount", { note, amount: corrected ?? 0 }), evidence: note,
    });
    revalidatePath("/", "layout");
    return { id: (ins.data as { id: string }).id };
  });
}
