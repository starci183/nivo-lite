import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logEvidence } from "./core";
import { formatVnd, resumeWork, runWork, type EngineCtx } from "./engine";
import type { FlowAction, WorkItem } from "./flow-types";
import { writeMessage } from "./automation-ai";
import type { PipelineRow } from "./automation-queries";
import type { AutomationRunStatus, MessageVars, PipelineConfig, RunStep, TemplateDef } from "./automation-shared";
import type { Lead } from "./types";

/**
 * The plumbing every automation executor shares: the run record (one row per trigger, unique per pipeline and dedupe key), the way a message to a
 * customer leaves (ALWAYS a work item through the authority gate: `runWork` decides auto / ask by the owner's rule, so "ask" becomes a waiting
 * decision and is never sent directly), and small loaders.
 */
export type Db = SupabaseClient;

/** What an executor gets. */
export type RunCtx = {
  readonly db: Db;
  readonly ws: string;
  readonly pipeline: PipelineRow;
  readonly def: TemplateDef;
  readonly config: PipelineConfig;
  /** The approved message template (the frame's default when the owner never saved one). */
  readonly body: string;
  readonly shop: { readonly shop: string; readonly hours: string; readonly hoursRange: { from: number; to: number } | null };
};

export type StepEx = RunStep & { workItemId?: string; message?: string };
export type RunResult = { readonly status: AutomationRunStatus; readonly steps: ReadonlyArray<StepEx>; readonly evidence?: string | null };
export type Executor = (x: RunCtx, payload: Readonly<Record<string, unknown>>) => Promise<RunResult>;

export const MAX_ATTEMPTS = 3;
const now = () => new Date().toISOString();

export const str = (v: unknown): string => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));

/** Who the automations act as in the evidence log and on work items. */
export const actorOf = (def: TemplateDef): string => `Tự động hoá · ${def.name.vi}`;

/** The engine context an automation works under: service role (no session), Vietnamese. */
export const engineCtxFor = (x: Pick<RunCtx, "db" | "ws" | "def">): EngineCtx => ({ db: x.db, ws: x.ws, actor: actorOf(x.def), locale: "vi" });

/* ------------------------------------------------------------------ run records */

/** Record a trigger. Null when the same trigger already has a run (the dedupe key is unique per pipeline): nothing runs twice. */
export const beginRun = async (db: Db, p: PipelineRow, dedupe: string, triggerRef: string, payload: Readonly<Record<string, unknown>>, opts: { readonly runAt?: Date } = {}): Promise<{ id: string; attempts: number } | null> => {
  const later = opts.runAt && opts.runAt.getTime() > Date.now() + 1000;
  const { data, error } = await db.from("automation_runs").insert({
    pipeline_id: p.id, workspace_id: p.workspace_id, trigger_ref: triggerRef, dedupe_key: dedupe, payload, status: later ? "queued" : "running", attempts: later ? 0 : 1,
    run_at: (opts.runAt ?? new Date()).toISOString(),
  }).select("id, attempts").single();
  if (error) {
    if (error.code === "23505") return null;
    throw new Error(error.message);
  }
  return later ? null : (data as { id: string; attempts: number });
};

/** Take a queued or failed run that is due (guarded transition, so two ticks never execute it twice). */
export const claimRun = async (db: Db, id: string): Promise<{ id: string; attempts: number; payload: Record<string, unknown> } | null> => {
  const { data: cur } = await db.from("automation_runs").select("attempts, status").eq("id", id).maybeSingle();
  const c = cur as { attempts: number; status: string } | null;
  if (!c || !["queued", "failed"].includes(c.status)) return null;
  const { data } = await db.from("automation_runs").update({ status: "running", attempts: c.attempts + 1, error: null }).eq("id", id).eq("status", c.status).eq("attempts", c.attempts).select("id, attempts, payload");
  return ((data ?? [])[0] ?? null) as { id: string; attempts: number; payload: Record<string, unknown> } | null;
};

const BACKOFF_MINUTES = [2, 10, 30];

export const finishRun = async (db: Db, id: string, attempts: number, r: RunResult | { readonly error: string }): Promise<void> => {
  if ("error" in r) {
    const retry = attempts < MAX_ATTEMPTS;
    await db.from("automation_runs").update({
      status: "failed", error: r.error.slice(0, 500), run_at: new Date(Date.now() + (BACKOFF_MINUTES[attempts - 1] ?? 30) * 60_000).toISOString(),
      finished_at: retry ? null : now(), steps: [{ label: "Lỗi", status: "failed", detail: r.error.slice(0, 200) }],
    }).eq("id", id);
    return;
  }
  await db.from("automation_runs").update({
    status: r.status, steps: r.steps, evidence: r.evidence ?? null, error: null,
    finished_at: r.status === "waiting_approval" ? null : now(),
  }).eq("id", id);
};

/** Run one executor for one claimed run: any exception becomes a failed run that is retried with backoff (up to MAX_ATTEMPTS). */
export const executeRun = async (x: RunCtx, run: { id: string; attempts: number }, payload: Readonly<Record<string, unknown>>, fn: Executor): Promise<AutomationRunStatus> => {
  try {
    const out = await fn(x, payload);
    await finishRun(x.db, run.id, run.attempts, out);
    return out.status;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`automation ${x.def.key} failed:`, msg);
    await finishRun(x.db, run.id, run.attempts, { error: msg });
    return "failed";
  }
};

/* ------------------------------------------------------------------ loaders */

export const loadLead = async (db: Db, ws: string, id: string): Promise<Lead | null> =>
  ((await db.from("leads").select("*").eq("workspace_id", ws).eq("id", id).maybeSingle()).data ?? null) as Lead | null;

export type Conv = { id: string; channel: string | null; handled_by: string | null; agent_id: string };

/** The customer's latest real conversation (website chat or Telegram): where a message to them leaves. */
export const customerConversation = async (db: Db, ws: string, leadId: string): Promise<Conv | null> =>
  (((await db.from("agent_conversations").select("id, channel, handled_by, agent_id").eq("workspace_id", ws).eq("lead_id", leadId).eq("kind", "customer").order("created_at", { ascending: false }).limit(1)).data ?? [])[0] ?? null) as Conv | null;

export const lastActivityOf = async (db: Db, ws: string, leadIds: ReadonlyArray<string>, created: ReadonlyMap<string, string>): Promise<Map<string, number>> => {
  const out = new Map<string, number>(leadIds.map((id) => [id, Date.parse(created.get(id) ?? "") || 0]));
  if (!leadIds.length) return out;
  const { data } = await db.from("events").select("lead_id, created_at").eq("workspace_id", ws).in("lead_id", [...leadIds]).order("created_at", { ascending: false }).limit(2000);
  for (const e of (data ?? []) as Array<{ lead_id: string; created_at: string }>) out.set(e.lead_id, Math.max(out.get(e.lead_id) ?? 0, Date.parse(e.created_at)));
  return out;
};

export const varsFor = (x: RunCtx, extra: Partial<MessageVars>): MessageVars => ({ ten_shop: x.shop.shop, gio_mo_cua: x.shop.hours, ...extra });

export const vndText = (n: number | null | undefined): string => formatVnd(n ?? null, "vi");

/** A line in Office from NIVO (optionally about a lead). */
export const postOffice = async (db: Db, ws: string, body: string, leadId: string | null = null): Promise<void> => {
  await db.from("messages").insert({ workspace_id: ws, author_kind: "system", author_name: "NIVO", agent_id: null, body, lead_id: leadId });
};

/* ------------------------------------------------------------------ the one way a customer message leaves */

export type SendArgs = {
  readonly action: Exclude<FlowAction, "classify_lead" | "handoff_lead" | "send_quote" | "confirm_order" | "issue_invoice" | "reconcile_payment">;
  readonly lead: Lead;
  readonly conversationId?: string;
  readonly text: string;
  /** Unique per occurrence: the work item dedupe key, so a repeated trigger never sends twice. */
  readonly dedupe: string;
  readonly summary: string;
  readonly forceAsk?: boolean;
};

/**
 * Put a customer message through the authority gate as a work item (preset: the text is already written, no model call here).
 * The owner's rule for the action decides: auto sends it on the conversation's own channel, ask leaves a waiting decision in Office. A message that waits
 * is NOT sent; when the owner has accepted "Cho tự gửi" for this automation and the only reason to wait is the rule's mode, it is approved on their behalf
 * and recorded as such.
 */
export const sendThroughGate = async (x: RunCtx, a: SendArgs): Promise<{ item: WorkItem; state: "sent" | "waiting" | "failed" | "rejected" }> => {
  const c = engineCtxFor(x);
  const contact = a.lead.phone || a.lead.email || "website";
  const isReply = a.action === "reply_customer";
  let item = await runWork(c, {
    action: a.action, subject_type: isReply ? "conversation" : "lead", subject_id: isReply ? (a.conversationId ?? null) : a.lead.id, lead_id: a.lead.id,
    dedupeKey: `automation:${x.pipeline.id}:${a.dedupe}`, origin: a.lead.origin ?? "live", preset: true, noChain: true,
    ...(a.forceAsk ? { forceAsk: "over_authority" as const } : {}),
    seed: { summary: a.summary, draft: a.text, fields: { customer: a.lead.contact_name, contact, ...(isReply ? { conversation_id: a.conversationId ?? "", question: "" } : {}) } },
  });
  if (item.status === "waiting_decision" && x.pipeline.auto_send && !a.forceAsk && item.reasons.every((r) => r === "over_authority")) {
    item = await resumeWork(c, item.id, "approved", {}, { name: "Tự gửi (chủ shop đã cho phép)", kind: "owner" }, "Tự động hoá được chủ shop cho phép tự gửi.");
    await logEvidence(x.db, x.ws, { lead_id: a.lead.id, work_item_id: item.id, kind: "automation.auto_send", actor: actorOf(x.def), summary: `Tự gửi theo quyền chủ shop đã cho: ${x.def.name.vi}` });
  }
  const state = item.status === "done" ? "sent" : item.status === "waiting_decision" ? "waiting" : item.status === "rejected" ? "rejected" : "failed";
  return { item, state };
};

/** Write (fixed: fill; ai_per_case: model within the approved body) and send one customer message; returns the run result for it. */
export const composeAndSend = async (x: RunCtx, a: Omit<SendArgs, "text"> & { readonly vars: Partial<MessageVars>; readonly caseNote: string }): Promise<RunResult> => {
  const vars = varsFor(x, a.vars);
  const written = await writeMessage(x.db, x.ws, x.def, x.body, vars, a.caseNote);
  const { item, state } = await sendThroughGate(x, { ...a, text: written.text });
  const step = (label: string, status: StepEx["status"], detail?: string): StepEx => ({ label, status, detail, workItemId: item.id, message: written.text });
  const draft: StepEx = { label: written.generated ? "NIVO soạn tin theo khuôn đã duyệt" : "Điền tin theo khuôn đã duyệt", status: "done", message: written.text };
  if (state === "sent") return { status: "done", steps: [draft, step("Đã gửi cho khách", "done", item.result?.summary)], evidence: item.result?.summary ?? null };
  if (state === "waiting") return { status: "waiting_approval", steps: [draft, step("Chờ bạn duyệt", "waiting", `Lý do: ${item.reason ?? "cần duyệt"}`)], evidence: "Đang chờ quyết định trong Văn phòng" };
  if (state === "rejected") return { status: "skipped", steps: [draft, step("Bạn đã từ chối tin này", "skipped")] };
  throw new Error(item.error ?? "Không gửi được tin cho khách.");
};

