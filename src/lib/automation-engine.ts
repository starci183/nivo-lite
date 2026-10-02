import "server-only";
import { logEvidence } from "./core";
import { hhmmToMinutes, isOutsideHours, vnClock } from "./automation-hours";
import { loadShopContext, type PipelineRow } from "./automation-queries";
import {
  MAX_ATTEMPTS, beginRun, claimRun, customerConversation, executeRun, lastActivityOf, str,
  type Db, type Executor, type RunCtx,
} from "./automation-runs";
import { afterHours, askReview, checkFeedback, dailyReport, debtReminder, nurtureLead, sheetOrders, thankPayment, winBack } from "./automation-executors";
import { TRUST_THRESHOLD, resolveConfig, type PipelineConfig, type TemplateDef } from "./automation-shared";
import { templateOf } from "./automation-templates";
import { INVENTORY_EXECUTORS, scanInventory } from "./module-inventory-automations";
import { BOOKING_EXECUTORS, BOOKING_TEMPLATE_KEYS, scanBooking } from "./module-booking-automations";
import { runBookingTick } from "./module-booking-tick";
import { supabaseAdmin } from "./supabase/admin";

/**
 * The automation engine. Two ways in:
 *   onBusinessEvent   called by emitEvent (src/lib/outbound-events.ts) right after a business write: evaluates the workspace's ENABLED pipelines for that event
 *                     (idempotent: a pipeline's dedupe key is unique per trigger).
 *   runTick           called every minute by the protected route /api/automation/tick (pg_cron + pg_net): scheduled and scanning templates, due runs, retries.
 * Nothing here talks to a customer directly: executors go through the authority gate (automation-runs.ts sendThroughGate).
 */
const EXECUTORS: Readonly<Record<string, Executor>> = {
  thank_payment: thankPayment, ask_review: askReview, nurture_leads: nurtureLead, win_back: winBack, debt_reminder: debtReminder,
  after_hours: afterHours, daily_report: dailyReport, sheet_orders: sheetOrders,
  ...INVENTORY_EXECUTORS,
  ...BOOKING_EXECUTORS,
};

const DAY = 86_400_000;

type Loaded = { p: PipelineRow; def: TemplateDef; config: PipelineConfig };

const enabledPipelines = async (db: Db, ws?: string): Promise<Array<Loaded>> => {
  let q = db.from("automation_pipelines").select("*").eq("enabled", true);
  if (ws) q = q.eq("workspace_id", ws);
  return ((await q).data ?? []).flatMap((p) => {
    const def = templateOf((p as PipelineRow).template_key);
    return def && def.executor === "implemented" ? [{ p: p as PipelineRow, def, config: resolveConfig(def, (p as PipelineRow).config) }] : [];
  });
};

const shopCache = new Map<string, { at: number; value: RunCtx["shop"] }>();
const shopOf = async (db: Db, ws: string): Promise<RunCtx["shop"]> => {
  const hit = shopCache.get(ws);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  const s = await loadShopContext(db, ws);
  const value = { shop: s.shop, hours: s.hours, hoursRange: s.hoursRange };
  shopCache.set(ws, { at: Date.now(), value });
  return value;
};

const ctxFor = async (db: Db, l: Loaded): Promise<RunCtx> => ({
  db, ws: l.p.workspace_id, pipeline: l.p, def: l.def, config: l.config, body: l.p.body ?? l.def.defaultBody?.vi ?? "", shop: await shopOf(db, l.p.workspace_id),
});

/** Record a trigger and, unless it is scheduled for later or already ran, execute it now. */
const trigger = async (db: Db, l: Loaded, dedupe: string, triggerRef: string, payload: Record<string, unknown>, opts: { runAt?: Date } = {}): Promise<void> => {
  const run = await beginRun(db, l.p, dedupe, triggerRef, payload, opts);
  if (!run) return;
  await executeRun(await ctxFor(db, l), run, payload, EXECUTORS[l.def.key]);
};

/* ------------------------------------------------------------------ events */

export const onBusinessEvent = async (ws: string, event: string, data: Readonly<Record<string, unknown>>, dedupe: string): Promise<void> => {
  const db = supabaseAdmin();
  if (event === "decision.made") return onDecision(db, ws, data);
  const list = await enabledPipelines(db, ws);
  if (list.length === 0) return;
  for (const l of list) {
    try {
      switch (`${l.def.key}:${event}`) {
        case "thank_payment:payment.received":
          // A minute and a half later: NIVO's own care message after a payment (the default chain) is queued right behind this event; the thank-you
          // looks for it first so the customer never gets two thank-yous.
          await trigger(db, l, `thank:${dedupe}`, str(data.invoice_id), { ...data, at: new Date().toISOString() }, { runAt: new Date(Date.now() + 90_000) });
          break;
        case "ask_review:payment.received":
          await trigger(db, l, `review:${dedupe}`, str(data.lead_id), { ...data }, { runAt: new Date(Date.now() + Number(l.config.afterDays || 1) * DAY) });
          break;
        case "after_hours:message.inbound":
          await onInbound(db, l, data, dedupe);
          break;
        case "sheet_orders:order.confirmed":
        case "sheet_orders:deal.won":
        case "sheet_orders:payment.received":
        case "sheet_orders:lead.created":
          await trigger(db, l, `sheet:${dedupe}`, str(data.order_no) || str(data.lead_id), { event, data, at: new Date().toISOString() });
          break;
        default:
          break;
      }
    } catch (e) {
      console.error(`automation ${l.def.key} on ${event} failed:`, e instanceof Error ? e.message : e);
    }
  }
  if (event === "message.inbound") await onFeedback(db, list, data);
};

/** A customer message: outside opening hours the "after hours" pipeline answers (once per conversation per day). */
const onInbound = async (db: Db, l: Loaded, data: Readonly<Record<string, unknown>>, dedupe: string): Promise<void> => {
  const x = await ctxFor(db, l);
  const range = x.shop.hoursRange ?? { from: hhmmToMinutes(String(l.config.openFrom)), to: hhmmToMinutes(String(l.config.openTo)) };
  const clock = vnClock();
  if (!isOutsideHours(clock.minute, range)) return;
  await trigger(db, l, `after:${str(data.conversation_id)}:${clock.day}`, str(data.conversation_id), { ...data, dedupe });
};

/** A customer replies after a review request: a negative answer tags the owner in Office (once per request). */
const onFeedback = async (db: Db, list: ReadonlyArray<Loaded>, data: Readonly<Record<string, unknown>>): Promise<void> => {
  const l = list.find((x) => x.def.key === "ask_review");
  const leadId = str(data.lead_id);
  if (!l || !leadId) return;
  const since = new Date(Date.now() - 7 * DAY).toISOString();
  const { data: runs } = await db.from("automation_runs").select("id, payload").eq("pipeline_id", l.p.id).eq("trigger_ref", leadId).eq("status", "done").gte("created_at", since).order("created_at", { ascending: false }).limit(1);
  const run = ((runs ?? [])[0] ?? null) as { id: string; payload: Record<string, unknown> } | null;
  if (!run || run.payload.alerted) return;
  await checkFeedback(await ctxFor(db, l), run, str(data.text), leadId);
};

/** The owner decided a work item: finish the automation run that was waiting for it and keep the trust ladder. */
const onDecision = async (db: Db, ws: string, data: Readonly<Record<string, unknown>>): Promise<void> => {
  const itemId = str(data.work_item_id);
  const outcome = str(data.outcome);
  if (!itemId) return;
  const { data: rows } = await db.from("automation_runs").select("id, pipeline_id, steps").eq("workspace_id", ws).eq("status", "waiting_approval").contains("steps", JSON.stringify([{ workItemId: itemId }]));
  for (const r of (rows ?? []) as Array<{ id: string; pipeline_id: string; steps: Array<Record<string, unknown>> }>) {
    const rejected = outcome === "rejected";
    const steps = [...r.steps.filter((s) => s.status !== "waiting"), { label: rejected ? "Bạn đã từ chối tin này" : outcome === "edited" ? "Bạn đã sửa rồi duyệt, tin đã gửi" : "Bạn đã duyệt, tin đã gửi", status: rejected ? "skipped" : "done", workItemId: itemId }];
    await db.from("automation_runs").update({ status: rejected ? "skipped" : "done", steps, finished_at: new Date().toISOString(), evidence: `Quyết định của ${str(data.decided_by)}: ${outcome}` }).eq("id", r.id);
    const { data: pr } = await db.from("automation_pipelines").select("*").eq("id", r.pipeline_id).maybeSingle();
    const p = pr as PipelineRow | null;
    if (!p) continue;
    const streak = outcome === "approved" ? p.approval_streak + 1 : 0;
    const offer = streak >= TRUST_THRESHOLD && !p.auto_send && !p.trust_offered_at;
    await db.from("automation_pipelines").update({ approval_streak: streak, ...(offer ? { trust_offered_at: new Date().toISOString() } : {}) }).eq("id", p.id);
    if (offer) await logEvidence(db, ws, { kind: "automation.trust_offered", actor: "NIVO", summary: `Đề xuất cho "${p.name}" tự gửi sau ${streak} lần duyệt liên tiếp không sửa`, evidence: String(streak) });
  }
};

/* ------------------------------------------------------------------ the tick */

const BATCH = 8;

export const runTick = async (now: Date = new Date()): Promise<{ readonly pipelines: number; readonly runs: number }> => {
  const db = supabaseAdmin();
  const deadline = Date.now() + 25_000;
  const list = await enabledPipelines(db);
  let runs = 0;
  const budget = () => Date.now() < deadline;

  // 1. Scheduled runs that are due (a review request waiting for its day) and failed runs to retry.
  for (const l of list) {
    if (!budget()) break;
    const { data } = await db.from("automation_runs").select("id").eq("pipeline_id", l.p.id).in("status", ["queued", "failed"]).lt("attempts", MAX_ATTEMPTS).lte("run_at", now.toISOString()).order("run_at").limit(BATCH);
    for (const row of (data ?? []) as Array<{ id: string }>) {
      const claimed = await claimRun(db, row.id);
      if (!claimed) continue;
      await executeRun(await ctxFor(db, l), claimed, claimed.payload, EXECUTORS[l.def.key]);
      runs += 1;
    }
  }

  // 2. Scans: templates that look at the data on a clock.
  for (const l of list) {
    if (!budget()) break;
    try {
      runs += await scan(db, l, now);
    } catch (e) {
      console.error(`automation scan ${l.def.key} failed:`, e instanceof Error ? e.message : e);
    }
  }
  // 3. Booking module: due appointment reminders (built in, independent of any card).
  try {
    if (budget()) runs += (await runBookingTick(now.getTime())).reminders;
  } catch (e) {
    console.error("booking tick failed:", e instanceof Error ? e.message : e);
  }
  return { pipelines: list.length, runs };
};

type Seen = { n: number; last: number; waiting: boolean };
/** Per trigger_ref: how many real runs (not skipped/failed), when the last one was, whether one is still open; and every dedupe key already used (even by skipped runs). */
const countRuns = async (db: Db, p: PipelineRow, refs: ReadonlyArray<string>): Promise<Map<string, Seen> & { used: Set<string> }> => {
  const out = new Map<string, Seen>() as Map<string, Seen> & { used: Set<string> };
  out.used = new Set<string>();
  if (!refs.length) return out;
  const { data } = await db.from("automation_runs").select("trigger_ref, status, created_at, dedupe_key").eq("pipeline_id", p.id).in("trigger_ref", [...refs]);
  for (const r of (data ?? []) as Array<{ trigger_ref: string; status: string; created_at: string; dedupe_key: string }>) {
    out.used.add(r.dedupe_key);
    if (r.status === "skipped" || r.status === "failed") continue;
    const cur = out.get(r.trigger_ref) ?? { n: 0, last: 0, waiting: false };
    out.set(r.trigger_ref, { n: cur.n + 1, last: Math.max(cur.last, Date.parse(r.created_at)), waiting: cur.waiting || r.status === "waiting_approval" || r.status === "queued" || r.status === "running" });
  }
  return out;
};

const scan = async (db: Db, l: Loaded, now: Date): Promise<number> => {
  const { p, def, config } = l;
  const ws = p.workspace_id;
  let started = 0;
  if (def.moduleKey === "inventory") return scanInventory(db, l, now, (dedupe, ref, payload) => trigger(db, l, dedupe, ref, payload));
  if (BOOKING_TEMPLATE_KEYS.includes(def.key)) return scanBooking({ db, ws, def, config, now, pipelineId: p.id, trigger: (dedupe, ref, payload) => trigger(db, l, dedupe, ref, payload) });
  if (def.key === "daily_report") {
    const clock = vnClock(now);
    if (clock.minute >= hhmmToMinutes(String(config.time))) {
      const before = started;
      await trigger(db, l, `daily:${clock.day}`, clock.day, { day: clock.day });
      started = before + 1;
    }
    return started;
  }
  if (def.key === "nurture_leads" || def.key === "win_back") {
    const hours = def.key === "nurture_leads" ? Number(config.afterHours) : Number(config.afterDays) * 24;
    const since = new Date(now.getTime() - (def.key === "nurture_leads" ? 30 : 365) * DAY).toISOString();
    let q = db.from("leads").select("id, stage, created_at").eq("workspace_id", ws).gte("created_at", since).order("created_at", { ascending: false }).limit(200);
    q = def.key === "nurture_leads" ? q.in("stage", ["new", "qualified", "proposal"]) : q.neq("stage", "lost");
    const leads = ((await q).data ?? []) as Array<{ id: string; stage: string; created_at: string }>;
    if (!leads.length) return 0;
    const ids = leads.map((x) => x.id);
    const activity = await lastActivityOf(db, ws, ids, new Map(leads.map((x) => [x.id, x.created_at])));
    const withChat = new Set((((await db.from("agent_conversations").select("lead_id").eq("workspace_id", ws).eq("kind", "customer").in("lead_id", ids)).data ?? []) as Array<{ lead_id: string }>).map((c) => c.lead_id));
    const prior = await countRuns(db, p, ids);
    for (const lead of leads) {
      if (started >= BATCH) break;
      if (!withChat.has(lead.id)) continue;
      if (now.getTime() - (activity.get(lead.id) ?? 0) < hours * 3_600_000) continue;
      const seen = prior.get(lead.id) ?? { n: 0, last: 0, waiting: false };
      if (seen.waiting) continue;
      if (seen.n > 0 && now.getTime() - seen.last < hours * 3_600_000) continue;
      if (def.key === "nurture_leads") {
        const k = seen.n + 1;
        if (k > Number(config.maxFollowUps) || prior.used.has(`nurture:${lead.id}:${k}`)) continue;
        await trigger(db, l, `nurture:${lead.id}:${k}`, lead.id, { lead_id: lead.id, k, dedupe: `nurture:${lead.id}:${k}` });
      } else {
        if (seen.n > 0) continue;
        const month = vnClock(now).day.slice(0, 7);
        if (prior.used.has(`winback:${lead.id}:${month}`)) continue;
        await trigger(db, l, `winback:${lead.id}:${month}`, lead.id, { lead_id: lead.id, dedupe: `winback:${lead.id}:${month}` });
      }
      started += 1;
    }
    return started;
  }
  if (def.key === "debt_reminder") {
    const cutoff = new Date(now.getTime() - Number(config.afterDays) * DAY).toISOString();
    type InvoiceRow = { id: string; invoice_no: string; amount_vnd: number; lead_id: string | null; due_at: string };
    const found = await db.from("invoices").select("id, invoice_no, amount_vnd, lead_id, due_at").eq("workspace_id", ws).eq("status", "issued").not("due_at", "is", null).lt("due_at", cutoff).order("due_at").limit(50);
    const inv = (found.data ?? []) as Array<InvoiceRow>;
    const prior = await countRuns(db, p, inv.map((i) => i.id));
    for (const i of inv) {
      if (started >= BATCH) break;
      if (!i.lead_id || !(await customerConversation(db, ws, i.lead_id))) continue;
      const seen = prior.get(i.id) ?? { n: 0, last: 0, waiting: false };
      if (seen.waiting || seen.n >= 2) continue;
      if (seen.n > 0 && now.getTime() - seen.last < Number(config.afterDays) * DAY) continue;
      const k = seen.n + 1;
      if (prior.used.has(`debt:${i.id}:${k}`)) continue;
      await trigger(db, l, `debt:${i.id}:${k}`, i.id, { invoice_id: i.id, invoice_no: i.invoice_no, amount_vnd: Number(i.amount_vnd), lead_id: i.lead_id, k, dedupe: `debt:${i.id}:${k}` });
      started += 1;
    }
    return started;
  }
  return 0;
};
