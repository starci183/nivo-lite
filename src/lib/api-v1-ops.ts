import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { translator } from "@/i18n/core";
import { system } from "@/i18n/dict/system";
import { ApiError, field } from "./api-v1";
import type { ApiPrincipal } from "./api-keys";
import { contactParts, ingest, logEvidence, matchLead } from "./core";
import { runWork, type EngineCtx } from "./engine";
import { drainAfter } from "./flow-ctx";
import { addSourceFor } from "./knowledge/index";
import { emitEvent } from "./outbound-events";
import { supabaseAdmin } from "./supabase/admin";
import type { Lead } from "./types";

/**
 * What each public endpoint does. EVERY write goes through the same path the app uses: a lead is an inbound event handed to the sales flow as a
 * `handoff_lead` work item, a message is a `reply_customer` work item, a won stage runs `issue_invoice` through the gate. The authority rules decide:
 * "auto" performs it, "ask" leaves a waiting decision in Office and nothing reaches the customer. Evidence always names the source `api:<key name>`.
 */
const STAGES = ["new", "qualified", "proposal", "won", "lost"] as const;
type Stage = (typeof STAGES)[number];

const ctxOf = (who: ApiPrincipal): EngineCtx => ({ db: supabaseAdmin(), ws: who.workspaceId, actor: `api:${who.name}`, locale: "vi" });

const bool = (v: unknown): boolean => v === true || v === "true";

/* ------------------------------------------------------------------ POST /api/v1/leads */

export type LeadResult = { lead_id: string | null; status: "created" | "updated" | "waiting_decision" | "unchanged"; work_item_id: string | null };

export const upsertLead = async (who: ApiPrincipal, body: Record<string, unknown>): Promise<LeadResult> => {
  const c = ctxOf(who);
  const { db, ws, actor } = c;
  const name = field(body, "name", { required: true, max: 120 });
  const phone = field(body, "phone", { max: 30 });
  const email = field(body, "email", { max: 120 });
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ApiError(400, "invalid_request", 'Trường "email" không đúng định dạng.');
  if (phone && !/^[+\d][\d\s().-]{5,}$/.test(phone)) throw new ApiError(400, "invalid_request", 'Trường "phone" không đúng định dạng.');
  const company = field(body, "company", { max: 120 });
  const needIn = field(body, "need", { max: 500 });
  const channel = field(body, "channel", { max: 60 }) || "API";
  const externalId = field(body, "external_id", { max: 100 });
  const note = field(body, "note", { max: 1000 });
  const stageIn = field(body, "stage", { max: 20 });
  if (stageIn && !(STAGES as ReadonlyArray<string>).includes(stageIn)) throw new ApiError(400, "invalid_request", `Trường "stage" phải là một trong: ${STAGES.join(", ")}.`);
  const stage = (stageIn || null) as Stage | null;
  const contact = phone || email || null;
  const t = translator(system, "vi");

  const parts = contactParts(contact);
  const existing = await matchLead(db, ws, { phone: parts.phone, email: parts.email, name, channel });
  const { event, duplicate } = await ingest(db, ws, {
    channel: "manual", kind: "lead", origin: "live", sender_name: name, sender_contact: contact, body: needIn || "Khách tạo qua API", amount_vnd: null,
    external_ref: `api:${who.name}`, event_id: externalId ? `api:${who.keyId}:${externalId}` : `api:${who.keyId}:${randomUUID()}`,
  }, (n) => t("duplicateBlocked", { n }));
  if (duplicate) return { lead_id: event.lead_id, status: "unchanged", work_item_id: null };

  const item = await runWork(c, {
    action: "handoff_lead", subject_type: "inbound", subject_id: event.id, inbound_event_id: event.id, origin: "live", dedupeKey: `handoff_lead:inbound:${event.id}`,
    seed: { fields: { contact_name: name, company, need: needIn || "Khách tạo qua API", contact, channel_label: channel } },
  });
  const leadId = item.lead_id ?? event.lead_id ?? existing?.id ?? null;
  await logEvidence(db, ws, {
    lead_id: leadId, work_item_id: item.id, kind: "api.lead", actor, summary: `${existing ? "Cập nhật" : "Tạo"} khách qua API: ${name}`,
    evidence: `source=api:${who.name}${externalId ? ` external_id=${externalId}` : ""}`,
  });

  if (leadId && existing) {
    const patch: Record<string, string> = {};
    if (company) patch.company = company;
    if (needIn) patch.need = needIn;
    if (Object.keys(patch).length) {
      await db.from("leads").update(patch).eq("id", leadId);
      await logEvidence(db, ws, { lead_id: leadId, kind: "api.lead_updated", actor, summary: `Cập nhật thông tin khách qua API (${Object.keys(patch).join(", ")})`, evidence: `source=api:${who.name}` });
    }
  }
  if (leadId && note) await logEvidence(db, ws, { lead_id: leadId, kind: "api.note", actor, summary: "Ghi chú từ API", evidence: note });
  if (leadId && stage) await applyStage(c, who, leadId, stage);
  drainAfter(c);
  return { lead_id: leadId, status: item.status === "waiting_decision" ? "waiting_decision" : existing ? "updated" : "created", work_item_id: item.id };
};

/** A stage change from the API is an outcome like in the app: evidence first; won hands the deal to Accounting through the gate. Never reopens a closed deal by itself. */
const applyStage = async (c: EngineCtx, who: ApiPrincipal, leadId: string, stage: Stage): Promise<void> => {
  const { db, ws, actor } = c;
  const lead = (await db.from("leads").select("*").eq("id", leadId).eq("workspace_id", ws).maybeSingle()).data as Lead | null;
  if (!lead || lead.stage === stage) return;
  if (["won", "lost"].includes(lead.stage) && !["won", "lost"].includes(stage)) return;
  await db.from("leads").update({ stage }).eq("id", leadId);
  await logEvidence(db, ws, { lead_id: leadId, kind: "outcome.recorded", actor, summary: `Chuyển giai đoạn qua API: ${stage}`, evidence: `source=api:${who.name}` });
  if (stage === "won") {
    await runWork(c, {
      action: "issue_invoice", subject_type: "lead", subject_id: leadId, lead_id: leadId, origin: lead.origin ?? "live",
      dedupeKey: `issue_invoice:lead:${leadId}`, seed: { amount_vnd: null, fields: {} },
    });
    await emitEvent(ws, "deal.won", { lead_id: leadId, name: lead.contact_name, company: lead.company, channel: lead.channel, need: lead.need, source: `api:${who.name}` }, `deal.won:${leadId}`);
  }
};

/* ------------------------------------------------------------------ POST /api/v1/messages */

export type MessageResult = { work_item_id: string; status: "sent" | "waiting_decision" | "failed"; conversation_id: string };

/**
 * Ask the Chatbot to message a customer conversation. The text becomes a `reply_customer` work item: the owner's rule for that action decides. `require_approval: true`
 * forces a waiting decision whatever the rule says. A waiting message is NOT sent; it appears in Office for the owner to approve.
 */
export const sendMessage = async (who: ApiPrincipal, body: Record<string, unknown>, idempotencyKey: string | null): Promise<MessageResult> => {
  const c = ctxOf(who);
  const { db, ws, actor } = c;
  const text = field(body, "text", { required: true, max: 2000 });
  const conversationId = field(body, "conversation_id", { max: 60 });
  const leadId = field(body, "lead_id", { max: 60 });
  if (!conversationId && !leadId) throw new ApiError(400, "invalid_request", 'Cần "conversation_id" hoặc "lead_id".');
  const uuid = /^[0-9a-f-]{36}$/i;
  if ((conversationId && !uuid.test(conversationId)) || (leadId && !uuid.test(leadId))) throw new ApiError(400, "invalid_request", "Mã không đúng định dạng.");
  let q = db.from("agent_conversations").select("id, lead_id, agent_id, kind").eq("workspace_id", ws).eq("kind", "customer");
  q = conversationId ? q.eq("id", conversationId) : q.eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1);
  const conv = ((await q).data ?? [])[0] as { id: string; lead_id: string | null; agent_id: string } | undefined;
  if (!conv) throw new ApiError(404, "conversation_not_found", "Không tìm thấy cuộc trò chuyện với khách này.");
  const key = idempotencyKey?.trim() || randomUUID();
  const item = await runWork(c, {
    action: "reply_customer", subject_type: "conversation", subject_id: conv.id, lead_id: conv.lead_id, origin: "live",
    dedupeKey: `api:message:${who.keyId}:${createHash("sha256").update(`${key}:${conv.id}`).digest("hex").slice(0, 24)}`, preset: true, noChain: true,
    ...(bool(body.require_approval) ? { forceAsk: "over_authority" as const } : {}),
    seed: { summary: `Tin gửi qua API (${who.name}): ${text.slice(0, 80)}`, draft: text, fields: { conversation_id: conv.id, question: "", source: `api:${who.name}` } },
  });
  await logEvidence(db, ws, { lead_id: conv.lead_id, work_item_id: item.id, kind: "api.message", actor, summary: `Yêu cầu nhắn khách qua API: ${item.status === "done" ? "đã gửi" : item.status === "waiting_decision" ? "chờ duyệt" : item.status}`, evidence: `source=api:${who.name}` });
  drainAfter(c);
  return { work_item_id: item.id, status: item.status === "done" ? "sent" : item.status === "waiting_decision" ? "waiting_decision" : "failed", conversation_id: conv.id };
};

/* ------------------------------------------------------------------ POST /api/v1/knowledge */

export const addKnowledge = async (who: ApiPrincipal, body: Record<string, unknown>): Promise<{ id: string; status: string; chunks: number }> => {
  const { db, ws, actor } = ctxOf(who);
  const title = field(body, "title", { required: true, max: 160 });
  const content = field(body, "content", { required: true });
  const topic = field(body, "topic", { max: 80 }) || null;
  const visibility = field(body, "visibility", { max: 10 }) === "public" ? "public" : "internal";
  const tags = Array.isArray(body.tags) ? body.tags.filter((x): x is string => typeof x === "string").slice(0, 12) : [];
  let source;
  try {
    source = await addSourceFor(db, ws, null, { kind: "text", title, content, topic, tags, visibility });
  } catch (e) {
    throw new ApiError(400, "invalid_request", e instanceof Error ? e.message : "Không thêm được tri thức.");
  }
  await logEvidence(db, ws, { kind: "api.knowledge", actor, summary: `Thêm tri thức qua API: ${title}`, evidence: `source=api:${who.name} visibility=${visibility}` });
  return { id: source.id, status: source.status, chunks: source.chunkCount };
};

/* ------------------------------------------------------------------ GET /api/v1/leads and /api/v1/events */

export const listLeads = async (who: ApiPrincipal, status: string | null, limit: number): Promise<Array<Record<string, unknown>>> => {
  if (status && !(STAGES as ReadonlyArray<string>).includes(status)) throw new ApiError(400, "invalid_request", `Tham số "status" phải là một trong: ${STAGES.join(", ")}.`);
  let q = supabaseAdmin().from("leads").select("id, contact_name, company, channel, need, stage, phone, email, created_at").eq("workspace_id", who.workspaceId).order("created_at", { ascending: false }).limit(limit);
  if (status) q = q.eq("stage", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map((l) => ({ id: l.id, name: l.contact_name, company: l.company, channel: l.channel, need: l.need, stage: l.stage, phone: l.phone ?? null, email: l.email ?? null, created_at: l.created_at }));
};

export const listEvents = async (who: ApiPrincipal, since: string | null, limit: number): Promise<{ events: Array<Record<string, unknown>>; next_since: string }> => {
  const from = since ? Date.parse(since) : Date.now() - 86_400_000;
  if (!Number.isFinite(from)) throw new ApiError(400, "invalid_request", 'Tham số "since" phải là thời điểm ISO, ví dụ 2026-10-01T00:00:00Z.');
  const fromIso = new Date(from).toISOString();
  const { data, error } = await supabaseAdmin().from("events").select("id, kind, actor, summary, evidence, lead_id, created_at").eq("workspace_id", who.workspaceId).gt("created_at", fromIso).order("created_at", { ascending: true }).limit(limit);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ id: string; kind: string; actor: string; summary: string; evidence: string | null; lead_id: string | null; created_at: string }>;
  return { events: rows.map((r) => ({ ...r, evidence: r.evidence ? r.evidence.slice(0, 500) : null })), next_since: rows.at(-1)?.created_at ?? fromIso };
};

