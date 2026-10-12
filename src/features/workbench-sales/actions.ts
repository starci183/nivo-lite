"use server";

import { revalidatePath } from "next/cache";
import { translator } from "@/i18n/core";
import { workbenchSales } from "@/i18n/dict/workbenchSales";
import { logDecision, logEvidence } from "@/lib/core";
import { runWork, type EngineCtx } from "@/lib/engine";
import { drainAfter, engineCtx } from "@/lib/flow-ctx";
import type { Invoice, Order, WorkItem } from "@/lib/flow-types";
import { deciderOf, requireDecide } from "@/lib/permissions";
import { emitEvent } from "@/lib/outbound-events";
import { CONTRACT_STATUSES, isContractStatus, isIsoDay, type Contract, type ContractInput } from "@/lib/sales-contracts-shared";
import { supabaseAdmin } from "@/lib/supabase/admin";
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

/**
 * "Mark shipped": the order was handed to a carrier. Records shipped_at, carrier and tracking code once and announces `order.shipped`, which the
 * "Báo giao hàng" automation (when switched on) turns into a message to the customer through the authority gate. Any signed-in member may do it.
 */
export async function markOrderShipped(orderId: string, input: { readonly carrier: string; readonly trackingCode: string }): Promise<Outcome<{ orderNo: string }>> {
  return run(async () => {
    const c = await engineCtx();
    const carrier = input.carrier.trim().slice(0, 80);
    const trackingCode = input.trackingCode.trim().slice(0, 80);
    if (!carrier) throw new Error(W(c)("errCarrier"));
    if (!trackingCode) throw new Error(W(c)("errTracking"));
    const { data: orderRow, error } = await c.db.from("orders").select("*").eq("id", orderId).eq("workspace_id", c.ws).maybeSingle();
    if (error) throw new Error(error.message);
    const order = orderRow as Order | null;
    if (!order) throw new Error(W(c)("errNotFound"));
    if (!["confirmed", "invoiced", "paid"].includes(order.status)) throw new Error(W(c)("errNotShippable"));
    if (order.shipped_at) throw new Error(W(c)("errAlreadyShipped"));
    const shippedAt = new Date().toISOString();
    const upd = await c.db.from("orders").update({ shipped_at: shippedAt, carrier, tracking_code: trackingCode }).eq("id", order.id).eq("workspace_id", c.ws).is("shipped_at", null).select("id");
    if (upd.error) throw new Error(upd.error.message);
    if (!upd.data?.length) throw new Error(W(c)("errAlreadyShipped"));
    await logEvidence(c.db, c.ws, { lead_id: order.lead_id, kind: "order.shipped", actor: c.actor, summary: W(c)("evShipped", { who: c.actor, no: order.order_no, carrier }), evidence: trackingCode });
    await emitEvent(c.ws, "order.shipped", { order_id: order.id, order_no: order.order_no, lead_id: order.lead_id, carrier, tracking_code: trackingCode, shipped_at: shippedAt }, `order.shipped:${order.id}`);
    refresh();
    return { orderNo: order.order_no };
  });
}

const dayOrThrow = (c: EngineCtx, v: string): string => {
  const d = v.trim();
  if (!isIsoDay(d)) throw new Error(W(c)("errDate"));
  return d;
};

/** Add or edit a recurring contract (the renewal automation reads these). Any signed-in member may; an edit changes only this workspace's own row. */
export async function saveContract(input: ContractInput): Promise<Outcome<Contract>> {
  return run(async () => {
    const c = await engineCtx();
    const customerName = input.customerName.trim().slice(0, 120);
    if (!customerName) throw new Error(W(c)("errContractCustomer"));
    const startsOn = dayOrThrow(c, input.startsOn);
    const endsOn = dayOrThrow(c, input.endsOn);
    if (endsOn < startsOn) throw new Error(W(c)("errContractDates"));
    if (!isContractStatus(input.status)) throw new Error(W(c)("errContractStatus", { list: CONTRACT_STATUSES.join(", ") }));
    if (input.amountVnd !== null && (!Number.isFinite(input.amountVnd) || input.amountVnd < 0)) throw new Error(W(c)("errContractAmount"));
    const db = supabaseAdmin();
    if (input.leadId) {
      const lead = await db.from("leads").select("id").eq("id", input.leadId).eq("workspace_id", c.ws).maybeSingle();
      if (!lead.data) throw new Error(W(c)("errNotFound"));
    }
    const row = { lead_id: input.leadId, customer_name: customerName, plan: input.plan.trim().slice(0, 120), starts_on: startsOn, ends_on: endsOn, amount_vnd: input.amountVnd, status: input.status, note: input.note.trim().slice(0, 500), updated_at: new Date().toISOString() };
    const q = input.id
      ? db.from("contracts").update(row).eq("id", input.id).eq("workspace_id", c.ws)
      : db.from("contracts").insert({ ...row, workspace_id: c.ws });
    const { data, error } = await q.select("*").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(W(c)("errNotFound"));
    await logEvidence(c.db, c.ws, { lead_id: input.leadId, kind: input.id ? "contract.updated" : "contract.created", actor: c.actor, summary: W(c)(input.id ? "evContractUpdated" : "evContractCreated", { who: c.actor, customer: customerName }), evidence: `${startsOn} → ${endsOn}` });
    refresh();
    return data as Contract;
  });
}
