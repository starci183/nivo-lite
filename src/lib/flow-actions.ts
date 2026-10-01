"use server";

import { revalidatePath } from "next/cache";
import { deliverToChannel } from "./telegram";
import { translator } from "@/i18n/core";
import { system } from "@/i18n/dict/system";
import { governance } from "@/i18n/dict/governance";
import { office } from "@/i18n/dict/office";
import { ingest, logEvidence } from "./core";
import { resumeWork, startInboundWork, startOrderWork, type EngineCtx } from "./engine";
import { applyAuthorityCore, ownerChat, saveAuthorityCore, saveRuleCore } from "./owner-chat";
import { drainAfter, engineCtx } from "./flow-ctx";
import type { AgentConversation, AgentMessage, Outcome } from "./types";
import type {
  Authority, AuthorityRule, Department, FlowAction, InboundEvent, RuleMode, SimulateInboundInput, Staff, WorkEdits, WorkItem,
} from "./flow-types";

/* ------------------------------------------------------------------ helpers */

const run = async <T>(fn: () => Promise<T>): Promise<Outcome<T>> => {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

const refresh = () => revalidatePath("/", "layout");
const T = (c: EngineCtx) => translator(system, c.locale);
const G = (c: EngineCtx) => translator(governance, c.locale) as (k: string, v?: Record<string, string | number>) => string;

/* ------------------------------------------------------------------ authority */

/** Save goals, policies, reply style, brand voice and the limits note. */
export async function saveAuthority(patch: Partial<Omit<Authority, "workspace_id" | "updated_by" | "updated_at">>): Promise<Outcome<Authority>> {
  return run(async () => {
    const c = await engineCtx();
    const a = await saveAuthorityCore(c, patch);
    await logEvidence(c.db, c.ws, { kind: "authority.updated", actor: c.actor, summary: Object.keys(patch).join(", ") });
    refresh();
    return a;
  });
}

/** Save one department × action rule (mode, VND limit, required fields). */
export async function saveRule(input: { department: Department; action: FlowAction; mode: RuleMode; limit_vnd: number | null; required_fields?: Array<string>; note?: string }): Promise<Outcome<AuthorityRule>> {
  return run(async () => {
    const c = await engineCtx();
    const r = await saveRuleCore(c, input);
    await logEvidence(c.db, c.ws, { kind: "authority.rule_updated", actor: c.actor, summary: `${input.department}.${input.action} → ${input.mode}${input.limit_vnd !== null ? ` < ${input.limit_vnd}` : ""}` });
    refresh();
    return r;
  });
}

/** Add or update an optional staff member. */
export async function saveStaff(input: { id?: string; name: string; role: string; email?: string | null; active?: boolean }): Promise<Outcome<Staff>> {
  return run(async () => {
    const c = await engineCtx();
    if (!input.name?.trim()) throw new Error(T(c)("staffNameRequired"));
    const row = { name: input.name.trim(), role: input.role?.trim() ?? "", email: input.email?.trim() || null, ...(input.active !== undefined ? { active: input.active } : {}) };
    const res = input.id
      ? await c.db.from("staff").update(row).eq("id", input.id).eq("workspace_id", c.ws).select().single()
      : await c.db.from("staff").insert({ workspace_id: c.ws, ...row }).select().single();
    if (res.error) throw new Error(res.error.message);
    refresh();
    return res.data as Staff;
  });
}

/* ------------------------------------------------------------------ inputs */

const WORK_FOR_KIND: Partial<Record<SimulateInboundInput["kind"], FlowAction>> = {
  message: "handoff_lead", lead: "handoff_lead", order: "confirm_order", payment: "reconcile_payment",
};

/** Clearly labelled simulated input (Zalo, Facebook, email, phone, bank, manual): dedupe, then the matching AI department runs. */
export async function simulateInbound(input: SimulateInboundInput): Promise<Outcome<{ event: InboundEvent; duplicate: boolean; workItem: WorkItem | null }>> {
  return run(async () => {
    const c = await engineCtx();
    const t = T(c);
    const name = input.sender_name?.trim() ?? "";
    if (!name && input.kind !== "payment") throw new Error(t("nameRequired"));
    const amount = input.amount_vnd === undefined || input.amount_vnd === null ? null : Number(input.amount_vnd);
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) throw new Error(t("amountInvalid"));
    const { event, duplicate } = await ingest(c.db, c.ws, {
      channel: input.channel, kind: input.kind, origin: "simulated", sender_name: name || null, sender_contact: input.sender_contact?.trim() || null,
      body: input.body?.trim() ?? "", amount_vnd: amount === null ? null : Math.round(amount), external_ref: input.external_ref?.trim() || null,
      event_id: input.event_id?.trim() || null,
    }, (n) => t("duplicateBlocked", { n }));
    if (duplicate) {
      refresh();
      return { event, duplicate, workItem: null };
    }
    const action = WORK_FOR_KIND[input.kind];
    if (!action) {
      // Documents (supplier invoices) are recorded for Accounting AI; no automatic step is defined for them yet.
      const upd = await c.db.from("inbound_events").update({ status: "processed" }).eq("id", event.id).select().single();
      await logEvidence(c.db, c.ws, { kind: "inbound.recorded", actor: G(c)("dept_accounting"), summary: t("inboundInvoiceRecorded"), evidence: event.body || null });
      refresh();
      return { event: (upd.data ?? event) as InboundEvent, duplicate, workItem: null };
    }
    const workItem = action === "confirm_order"
      ? await startOrderWork(c, event, { items: input.items?.trim() ?? "", amount_vnd: amount })
      : await startInboundWork(c, event, action, action === "handoff_lead"
        ? { fields: { contact_name: name, company: "", need: input.body?.trim() ?? "", contact: input.sender_contact?.trim() || null, channel_label: G(c)(`channel_${input.channel}`) } }
        : { amount_vnd: amount, fields: {} });
    const fresh = ((await c.db.from("inbound_events").select("*").eq("id", event.id).single()).data ?? event) as InboundEvent;
    drainAfter(c);
    refresh();
    return { event: fresh, duplicate, workItem };
  });
}

/* ------------------------------------------------------------------ decisions */

const deciderFor = async (c: EngineCtx & { session: { email: string } }) => {
  // Decisions are made by the signed-in user; a staff record with the same email marks them as staff.
  const { data } = await c.db.from("staff").select("name").eq("workspace_id", c.ws).eq("email", c.session.email).eq("active", true).limit(1);
  return data?.[0] ? { name: c.actor, kind: "staff" as const } : { name: c.actor, kind: "owner" as const };
};

/** Minimum length of the owner's written basis before an unclear bank credit may be marked paid. */
const BASIS_MIN_CHARS = 10;

/** Actions whose approval must carry an explicit written basis for confirming: a matching amount alone is not evidence. */
const NEEDS_BASIS: ReadonlyArray<FlowAction> = ["reconcile_payment"];

const O = (c: EngineCtx) => translator(office, c.locale) as (k: string, v?: Record<string, string | number>) => string;

const loadItem = async (c: EngineCtx, workItemId: string): Promise<WorkItem> => {
  const { data, error } = await c.db.from("work_items").select("*").eq("id", workItemId).eq("workspace_id", c.ws).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Not found");
  return data as WorkItem;
};

/**
 * Approve (optionally with edits / missing data / a chosen candidate) or reject a waiting item; NIVO resumes the same work.
 * `basis` is the owner's written reason the outcome is true (for example "customer sent a transfer screenshot"). It is required to
 * approve a payment reconciliation, is saved as the decision note and on the item, and is ignored for rejections.
 */
export async function decideWorkItem(workItemId: string, decision: "approved" | "rejected", edits?: WorkEdits, note?: string, basis?: string): Promise<Outcome<WorkItem>> {
  return run(async () => {
    const c = await engineCtx();
    const cleanBasis = basis?.trim().replace(/\s+/g, " ") ?? "";
    let decisionNote = note ?? null;
    if (decision === "approved") {
      const current = await loadItem(c, workItemId);
      if (NEEDS_BASIS.includes(current.action) && cleanBasis.length < BASIS_MIN_CHARS) throw new Error(O(c)("basisRequiredError", { n: BASIS_MIN_CHARS }));
      if (cleanBasis) decisionNote = [O(c)("basisNote", { basis: cleanBasis }), note?.trim()].filter(Boolean).join(" · ");
    }
    const by = await deciderFor(c);
    let item = await resumeWork(c, workItemId, decision, edits ?? {}, by, decisionNote);
    if (decision === "approved" && cleanBasis) {
      // Keep the basis with the finished work so the decided card (and the lead's flow) can show it.
      const fields = { ...(item.proposal?.fields ?? {}), basis: cleanBasis, basis_by: by.name, basis_at: new Date().toISOString() };
      const upd = await c.db.from("work_items").update({ proposal: { ...item.proposal, fields } }).eq("id", item.id).eq("workspace_id", c.ws).select().single();
      if (!upd.error && upd.data) item = upd.data as WorkItem;
      await logEvidence(c.db, c.ws, { lead_id: item.lead_id, work_item_id: item.id, kind: "decision.basis", actor: by.name, summary: O(c)("basisNote", { basis: cleanBasis }), evidence: cleanBasis });
    }
    drainAfter(c);
    refresh();
    return item;
  });
}

/**
 * "Not enough basis yet — keep waiting": record the owner's note on a waiting item without deciding it.
 * The item stays `waiting_decision`; the note is kept on the item and in the evidence log.
 */
export async function holdWorkItem(workItemId: string, note: string): Promise<Outcome<WorkItem>> {
  return run(async () => {
    const c = await engineCtx();
    const text = note.trim().replace(/\s+/g, " ");
    if (!text) throw new Error(O(c)("holdNoteRequired"));
    const current = await loadItem(c, workItemId);
    if (current.status !== "waiting_decision") throw new Error(O(c)("holdNotWaiting"));
    const fields = { ...(current.proposal?.fields ?? {}), hold_note: text, hold_by: c.actor, hold_at: new Date().toISOString() };
    const { data, error } = await c.db.from("work_items").update({ proposal: { ...current.proposal, fields }, updated_at: new Date().toISOString() })
      .eq("id", workItemId).eq("workspace_id", c.ws).eq("status", "waiting_decision").select().maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(O(c)("holdNotWaiting"));
    const w = data as WorkItem;
    await logEvidence(c.db, c.ws, { lead_id: w.lead_id, work_item_id: w.id, kind: "work.held", actor: c.actor, summary: O(c)("holdEvidence", { note: text }), evidence: text });
    refresh();
    return w;
  });
}

/** One invoice NIVO proposes for an unclear bank credit, with what the owner needs to verify it. */
export type ReconcileCandidate = { id: string; invoice_no: string; amount_vnd: number; status: string; customer: string | null; company: string | null;
  order_no: string | null; order_items: string | null; issued_at: string | null; due_at: string | null };

/** The bank credit plus full candidate invoices (customer, invoice code, amount, order) for a waiting reconciliation. */
export async function getReconcileDetails(workItemId: string): Promise<Outcome<{
  payment: { amount_vnd: number | null; payer: string | null; reference: string | null; occurred_at: string | null };
  candidates: Array<ReconcileCandidate>;
}>> {
  return run(async () => {
    const c = await engineCtx();
    const item = await loadItem(c, workItemId);
    const ids = (item.proposal?.candidates ?? []).map((x) => x.id);
    const tx = item.subject_type === "transaction" && item.subject_id
      ? (await c.db.from("transactions").select("amount_vnd, payer, reference, occurred_at").eq("id", item.subject_id).eq("workspace_id", c.ws).maybeSingle()).data
      : null;
    const rows = ids.length
      ? ((await c.db.from("invoices").select("id, invoice_no, amount_vnd, status, issued_at, due_at, order:orders(order_no, items), lead:leads(contact_name, company)").eq("workspace_id", c.ws).in("id", ids)).data ?? [])
      : [];
    // Embedded relations come back as an object or a one-element array depending on the client's inference.
    const one = <R,>(v: R | Array<R> | null | undefined): R | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
    const byId = new Map(rows.map((r) => [String(r.id), r]));
    const candidates = ids.flatMap((id) => {
      const r = byId.get(id);
      if (!r) return [];
      const order = one<{ order_no: string | null; items: string | null }>(r.order);
      const lead = one<{ contact_name: string | null; company: string | null }>(r.lead);
      return [{ id: String(r.id), invoice_no: String(r.invoice_no), amount_vnd: Number(r.amount_vnd), status: String(r.status), customer: lead?.contact_name ?? null,
        company: lead?.company || null, order_no: order?.order_no ?? null, order_items: order?.items || null, issued_at: r.issued_at ?? null, due_at: r.due_at ?? null }];
    });
    return {
      // A customer's "I have paid" claim has no bank transaction: show who said it and what they wrote.
      payment: {
        amount_vnd: tx?.amount_vnd ?? item.proposal?.amount_vnd ?? null,
        payer: tx?.payer ?? (typeof item.proposal?.fields?.payer === "string" ? item.proposal.fields.payer : null),
        reference: tx?.reference ?? (typeof item.proposal?.fields?.claim === "string" ? item.proposal.fields.claim : null),
        occurred_at: tx?.occurred_at ?? (item.subject_type === "invoice" ? item.created_at : null),
      },
      candidates,
    };
  });
}

/** Give an exception to a staff member (or take it back with null). The decision is still made by a signed-in user. */
export async function assignWorkItem(workItemId: string, staffId: string | null): Promise<Outcome<WorkItem>> {
  return run(async () => {
    const c = await engineCtx();
    let staffName: string | null = null;
    if (staffId) {
      const s = await c.db.from("staff").select("name").eq("id", staffId).eq("workspace_id", c.ws).maybeSingle();
      if (!s.data) throw new Error(T(c)("staffNotFound"));
      staffName = s.data.name as string;
    }
    const { data, error } = await c.db.from("work_items").update({ assigned_staff_id: staffId, updated_at: new Date().toISOString() }).eq("id", workItemId).eq("workspace_id", c.ws).select().single();
    if (error) throw new Error(error.message);
    const w = data as WorkItem;
    await logEvidence(c.db, c.ws, { lead_id: w.lead_id, work_item_id: w.id, kind: "work.assigned", actor: c.actor, summary: staffName ? `→ ${staffName}` : "→ —" });
    refresh();
    return w;
  });
}

/* ------------------------------------------------------------------ website conversation takeover */

/** A person takes over a website conversation (the AI goes quiet) or hands it back to the AI. */
export async function takeOverConversation(conversationId: string, take: boolean): Promise<Outcome<{ handled_by: string | null }>> {
  return run(async () => {
    const c = await engineCtx();
    const handled_by = take ? c.actor : null;
    const { error } = await c.db.from("agent_conversations").update({ handled_by, handled_at: take ? new Date().toISOString() : null }).eq("id", conversationId).eq("workspace_id", c.ws);
    if (error) throw new Error(error.message);
    await c.db.from("agent_messages").insert({ workspace_id: c.ws, conversation_id: conversationId, role: "system", body: T(c)(take ? "takenOver" : "returnedToAi", { user: c.actor }) });
    return { handled_by };
  });
}

/** While taken over: the person's reply to the customer (stored as the company's side of the conversation). */
export async function sendAsHuman(conversationId: string, body: string): Promise<Outcome<AgentMessage>> {
  return run(async () => {
    const c = await engineCtx();
    const conv = (await c.db.from("agent_conversations").select("*").eq("id", conversationId).eq("workspace_id", c.ws).single()).data as AgentConversation | null;
    if (!conv) throw new Error("Not found");
    const { data, error } = await c.db.from("agent_messages").insert({ workspace_id: c.ws, conversation_id: conversationId, role: "agent", body: body.trim() }).select().single();
    if (error) throw new Error(error.message);
    await deliverToChannel(c.db, conversationId, body.trim());
    await logEvidence(c.db, c.ws, { lead_id: conv.lead_id, kind: "conversation.human_reply", actor: c.actor, summary: T(c)("takenOverNoReply"), evidence: body.trim() });
    return data as AgentMessage;
  });
}

/* ------------------------------------------------------------------ owner chat (Office) */

/** Owner grants authority by chat: one LLM call extracts goals/policies/rules, saved with the same code as the forms. */
export async function applyAuthorityFromChat(text: string): Promise<Outcome<{ summary: string; authority: Authority; rules: Array<AuthorityRule> }>> {
  return run(async () => {
    const c = await engineCtx();
    const out = await applyAuthorityCore(c, text);
    refresh();
    return out;
  });
}

/** Called first by sendTeamMessage: authority changes (@nivo …) and chat decisions ("đồng ý", "từ chối") on waiting work. */
export async function handleOwnerChat(text: string): Promise<{ handled: boolean; reply?: string }> {
  try {
    const c = await engineCtx();
    const { handled, reply } = await ownerChat(c, text, await deciderFor(c));
    drainAfter(c);
    if (handled) refresh();
    return reply === undefined ? { handled } : { handled, reply };
  } catch (e) {
    return { handled: true, reply: e instanceof Error ? e.message : String(e) };
  }
}

/** Internal for sendTeamMessage (not part of the UI contract). */
export async function ownerChatForOffice(text: string): Promise<{ handled: boolean; reply?: string; posted: boolean }> {
  try {
    const c = await engineCtx();
    const out = await ownerChat(c, text, await deciderFor(c));
    drainAfter(c);
    return out;
  } catch (e) {
    return { handled: true, reply: e instanceof Error ? e.message : String(e), posted: false };
  }
}
