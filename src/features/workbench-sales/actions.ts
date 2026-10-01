"use server";

import { revalidatePath } from "next/cache";
import { translator } from "@/i18n/core";
import { workbenchSales } from "@/i18n/dict/workbenchSales";
import { logDecision, logEvidence } from "@/lib/core";
import { runWork, type EngineCtx } from "@/lib/engine";
import { drainAfter, engineCtx } from "@/lib/flow-ctx";
import type { Invoice, Order, WorkItem } from "@/lib/flow-types";
import { deciderOf, requireDecide } from "@/lib/permissions";
import type { Outcome } from "@/lib/types";

/* Sales workbench commands. Every command goes through the same engine and gate as the rest of NIVO. */

const run = async <T>(fn: () => Promise<T>): Promise<Outcome<T>> => {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

const refresh = () => revalidatePath("/", "layout");
const W = (c: EngineCtx) => translator(workbenchSales, c.locale);

const loadItem = async (c: EngineCtx, id: string): Promise<WorkItem> => {
  const { data, error } = await c.db.from("work_items").select("*").eq("id", id).eq("workspace_id", c.ws).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(W(c)("errNotFound"));
  return data as WorkItem;
};

/**
 * Put a failed or stopped step back in the queue so the engine runs it again through the gate.
 * `updated_at = created_at` marks it as a fresh queued step for the queue drain.
 */
const requeue = async (c: EngineCtx, item: WorkItem, from: ReadonlyArray<WorkItem["status"]>): Promise<void> => {
  const { data, error } = await c.db.from("work_items")
    .update({ status: "queued", error: null, reason: null, reasons: [], updated_at: item.created_at })
    .eq("id", item.id).eq("workspace_id", c.ws).in("status", [...from]).select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error(W(c)("errChanged"));
};

/** Try a failed step again. Only a person allowed to decide the item may do it. */
export async function retryFailedStep(workItemId: string): Promise<Outcome<{ id: string }>> {
  return run(async () => {
    const c = await engineCtx();
    const item = await loadItem(c, workItemId);
    await requireDecide(item, c.locale);
    if (item.status !== "failed") throw new Error(W(c)("errNotFailed"));
    await requeue(c, item, ["failed"]);
    await logEvidence(c.db, c.ws, { lead_id: item.lead_id, work_item_id: item.id, kind: "work.retried", actor: c.actor, summary: W(c)("evRetried", { who: c.actor }), evidence: item.error });
    drainAfter(c, 3);
    refresh();
    return { id: item.id };
  });
}

/** Stop a failed step for good: it is closed as rejected and recorded in the decision log with who stopped it. */
export async function stopFailedStep(workItemId: string): Promise<Outcome<{ id: string }>> {
  return run(async () => {
    const c = await engineCtx();
    const item = await loadItem(c, workItemId);
    const member = await requireDecide(item, c.locale);
    if (item.status !== "failed") throw new Error(W(c)("errNotFailed"));
    const { data, error } = await c.db.from("work_items")
      .update({ status: "rejected", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", item.id).eq("workspace_id", c.ws).eq("status", "failed").select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error(W(c)("errChanged"));
    const by = deciderOf(member);
    await logDecision(c.db, c.ws, {
      work_item_id: item.id, lead_id: item.lead_id, department: item.department, action: item.action, decided_by: by.name, decider_kind: by.kind,
      outcome: "rejected", reason: item.reason, note: W(c)("stopNote"),
    });
    await logEvidence(c.db, c.ws, { lead_id: item.lead_id, work_item_id: item.id, kind: "work.stopped", actor: by.name, summary: W(c)("evStopped", { who: by.name }), evidence: item.error });
    refresh();
    return { id: item.id };
  });
}

/**
 * "Hand to Accounting": a confirmed order with no invoice runs the existing issue_invoice work through the gate (the same dedupe key as the
 * automatic hand-off, so it can never double up). A step that failed or was stopped earlier is queued again.
 * The result says where it stands: done (invoice recorded), waiting_decision (Accounting asks for a decision), queued or failed.
 */
export async function handoffToAccounting(orderId: string): Promise<Outcome<{ status: WorkItem["status"] }>> {
  return run(async () => {
    const c = await engineCtx();
    const { data: orderRow, error } = await c.db.from("orders").select("*").eq("id", orderId).eq("workspace_id", c.ws).maybeSingle();
    if (error) throw new Error(error.message);
    const order = orderRow as Order | null;
    if (!order) throw new Error(W(c)("errNotFound"));
    if (order.status !== "confirmed") throw new Error(W(c)("errNotConfirmed"));
    const inv = await c.db.from("invoices").select("id, status").eq("workspace_id", c.ws).eq("order_id", order.id).neq("status", "void").limit(1);
    if ((inv.data as Array<Pick<Invoice, "id" | "status">> | null)?.length) throw new Error(W(c)("errAlreadyInvoiced"));

    let item = await runWork(c, {
      action: "issue_invoice", subject_type: "order", subject_id: order.id, lead_id: order.lead_id, origin: order.origin,
      dedupeKey: `issue_invoice:order:${order.id}`, seed: { amount_vnd: order.amount_vnd, fields: {} },
    });
    if (item.status === "failed" || item.status === "rejected") {
      await requeue(c, item, ["failed", "rejected"]);
      item = { ...item, status: "queued" };
    }
    await logEvidence(c.db, c.ws, { lead_id: order.lead_id, work_item_id: item.id, kind: "handoff.accounting", actor: c.actor, summary: W(c)("evHandoff", { who: c.actor, no: order.order_no }) });
    drainAfter(c, 3);
    refresh();
    return { status: item.status };
  });
}
