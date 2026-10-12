import "server-only";
import { createHash } from "node:crypto";
import { safeEqual } from "./channels";
import { supabaseAdmin } from "./supabase/admin";

/**
 * NIVO's side of the shared n8n pipelines.
 *  - startPipelineRun: n8n_start_run() (SQL) creates the run + its token and queues the engine job `n8n.emit` -> http://n8n:5678/webhook/nivo/<key>.
 *  - verifyRun: what /api/n8n/* does with the per-run bearer token (only the hash is stored, with an expiry; one run = one workspace).
 *  - the data n8n fetches (daily summary, overdue invoices, month ledger) and the owner recipients.
 * No wording lives here: subjects and bodies come from the shop's approved template in n8n_pipelines.config.
 */
export type RunContext = { readonly runId: string; readonly workspaceId: string; readonly templateKey: string; readonly config: Record<string, unknown> };

const hashToken = (t: string): string => createHash("sha256").update(t, "utf8").digest("hex");

/** The run a bearer token speaks for, or null (unknown run, wrong token, expired, already completed). */
export const verifyRun = async (authorization: string | null, expectedRunId?: string): Promise<RunContext | null> => {
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const runId = token?.split(".")[0];
  if (!token || !runId || !/^[0-9a-f-]{36}$/i.test(runId) || (expectedRunId && runId !== expectedRunId)) return null;
  const db = supabaseAdmin();
  const { data: run } = await db.from("n8n_runs").select("id, workspace_id, template_key, token_hash, expires_at, status").eq("id", runId).maybeSingle();
  if (!run || !safeEqual(run.token_hash as string, hashToken(token)) || Date.parse(run.expires_at as string) < Date.now()) return null;
  if (run.status === "done" || run.status === "failed" || run.status === "skipped") return null;
  // The pipeline lives in automation_pipelines (one gallery for every automation): its settings are `config`, the shop's approved wording is `body`.
  const { data: pipe } = await db.from("automation_pipelines").select("config, body").eq("workspace_id", run.workspace_id).eq("template_key", run.template_key).maybeSingle();
  const config = { ...((pipe?.config ?? {}) as Record<string, unknown>), ...(pipe?.body ? { body: pipe.body as string } : {}) };
  return { runId, workspaceId: run.workspace_id as string, templateKey: run.template_key as string, config };
};

/** Queue one run (a no-op returning null when the pipeline is off, unless `force`, or this event already ran). */
export const startPipelineRun = async (workspaceId: string, key: string, data: Record<string, unknown>, dedupe: string, force = false): Promise<string | null> => {
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  const { data: id, error } = await supabaseAdmin().rpc("n8n_start_run", {
    p_workspace: workspaceId, p_key: key, p_data: data, p_dedupe: dedupe, p_force: force, p_api_base: base && /^https:\/\//.test(base) ? base.replace(/\/$/, "") : null,
  });
  if (error) {
    console.error("n8n_start_run failed:", error.message);
    return null;
  }
  return (id as string | null) ?? null;
};

/* ------------------------------------------------------------------ formatting */

const TZ_OFFSET = "+07:00";
const vnd = (n: number): string => `${Math.round(n).toLocaleString("vi-VN")} ₫`;
const dmy = (iso: string | Date): string => new Date(iso).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });
/** Vietnam calendar day (yyyy-mm-dd) of an instant. */
const vnDay = (d: Date): string => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
const dayRange = (day: string): { from: string; to: string } => ({
  from: new Date(`${day}T00:00:00${TZ_OFFSET}`).toISOString(),
  to: new Date(new Date(`${day}T00:00:00${TZ_OFFSET}`).getTime() + 86_400_000).toISOString(),
});

export const shopNameOf = async (workspaceId: string): Promise<string> =>
  ((await supabaseAdmin().from("workspaces").select("name").eq("id", workspaceId).maybeSingle()).data as { name: string } | null)?.name ?? "NIVO";

/** Owner (and manager) emails of the workspace: the only addresses an owner-facing pipeline mail may go to, besides the configured accountant. */
export const ownerRecipients = async (workspaceId: string): Promise<Array<{ email: string; name: string }>> => {
  const db = supabaseAdmin();
  const { data } = await db.from("workspace_members").select("user_id, role, display_name").eq("workspace_id", workspaceId).eq("status", "active").in("role", ["owner", "manager"]);
  const out: Array<{ email: string; name: string }> = [];
  for (const m of (data ?? []) as Array<{ user_id: string; role: string; display_name: string }>) {
    const { data: u } = await db.auth.admin.getUserById(m.user_id);
    if (u.user?.email) out.push({ email: u.user.email.toLowerCase(), name: m.display_name });
  }
  return out;
};

/* ------------------------------------------------------------------ data n8n fetches */

export const dailySummary = async (workspaceId: string, dayParam?: string | null) => {
  const db = supabaseAdmin();
  const day = dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : vnDay(new Date());
  const { from, to } = dayRange(day);
  const [leads, tx, invoices, waiting, overdue, orders] = await Promise.all([
    db.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).gte("created_at", from).lt("created_at", to),
    db.from("transactions").select("amount_vnd").eq("workspace_id", workspaceId).eq("origin", "live").gte("occurred_at", from).lt("occurred_at", to),
    db.from("invoices").select("amount_vnd").eq("workspace_id", workspaceId).eq("origin", "live").eq("status", "issued").gte("issued_at", from).lt("issued_at", to),
    db.from("work_items").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "waiting_decision"),
    db.from("invoices").select("amount_vnd").eq("workspace_id", workspaceId).eq("origin", "live").eq("status", "issued").lt("due_at", new Date().toISOString()),
    db.from("orders").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("origin", "live").gte("confirmed_at", from).lt("confirmed_at", to),
  ]);
  const moneyIn = ((tx.data ?? []) as Array<{ amount_vnd: number }>).reduce((s, r) => s + Number(r.amount_vnd), 0);
  const invoiced = ((invoices.data ?? []) as Array<{ amount_vnd: number }>).reduce((s, r) => s + Number(r.amount_vnd), 0);
  const overdueRows = (overdue.data ?? []) as Array<{ amount_vnd: number }>;
  const overdueTotal = overdueRows.reduce((s, r) => s + Number(r.amount_vnd), 0);
  const n = {
    new_leads: leads.count ?? 0, orders_confirmed: orders.count ?? 0, money_in: moneyIn, money_in_count: tx.data?.length ?? 0, invoiced, invoices_issued: invoices.data?.length ?? 0,
    waiting_decisions: waiting.count ?? 0, overdue_count: overdueRows.length, overdue_total: overdueTotal,
  };
  const lines = [
    `- Khách mới: ${n.new_leads}`,
    `- Đơn đã chốt: ${n.orders_confirmed}`,
    `- Tiền về: ${vnd(n.money_in)} (${n.money_in_count} giao dịch)`,
    `- Hoá đơn đã xuất: ${n.invoices_issued} (${vnd(n.invoiced)})`,
    `- Hoá đơn quá hạn: ${n.overdue_count}${n.overdue_count ? ` (${vnd(n.overdue_total)})` : ""}`,
  ];
  const shop = await shopNameOf(workspaceId);
  const owners = await ownerRecipients(workspaceId);
  return {
    date: day, shop_name: shop, owners, numbers: n,
    variables: {
      ten_shop: shop, ngay: dmy(`${day}T12:00:00${TZ_OFFSET}`), tom_tat: lines.join("\n"),
      viec_cho: n.waiting_decisions ? `Đang có ${n.waiting_decisions} việc chờ bạn quyết định trong NIVO.` : "Không có việc nào đang chờ bạn quyết định.",
    },
  };
};

type InvoiceRow = { id: string; invoice_no: string; amount_vnd: number; due_at: string; lead_id: string | null };
type LeadRow = { id: string; contact_name: string; email: string | null };

export const overdueInvoices = async (workspaceId: string, config: Record<string, unknown>) => {
  const db = supabaseAdmin();
  const afterDays = Math.max(0, Number(config.after_days ?? 3));
  const repeatDays = Math.max(1, Number(config.repeat_days ?? 7));
  const cutoff = new Date(Date.now() - afterDays * 86_400_000).toISOString();
  const { data } = await db.from("invoices").select("id, invoice_no, amount_vnd, due_at, lead_id").eq("workspace_id", workspaceId).eq("origin", "live").eq("status", "issued").lt("due_at", cutoff).order("due_at").limit(200);
  const invoices = (data ?? []) as Array<InvoiceRow>;
  const leadIds = [...new Set(invoices.map((i) => i.lead_id).filter((x): x is string => Boolean(x)))];
  const leads = new Map<string, LeadRow>();
  if (leadIds.length) {
    const { data: ls } = await db.from("leads").select("id, contact_name, email").in("id", leadIds);
    for (const l of (ls ?? []) as Array<LeadRow>) leads.set(l.id, l);
  }
  const since = new Date(Date.now() - repeatDays * 86_400_000).toISOString();
  const { data: sent } = await db.from("email_messages").select("refs").eq("workspace_id", workspaceId).eq("purpose", "debt_reminder").in("status", ["sent", "waiting_decision"]).gte("created_at", since);
  const reminded = new Set(((sent ?? []) as Array<{ refs: { invoice_id?: string } }>).map((r) => r.refs?.invoice_id).filter(Boolean));
  const shop = await shopNameOf(workspaceId);
  const today = vnDay(new Date());
  const items: Array<Record<string, unknown>> = [];
  let noEmail = 0;
  let recent = 0;
  for (const inv of invoices) {
    const lead = inv.lead_id ? leads.get(inv.lead_id) : undefined;
    if (!lead?.email) { noEmail += 1; continue; }
    if (reminded.has(inv.id)) { recent += 1; continue; }
    items.push({
      to: lead.email.toLowerCase(), dedupe: `debt:${inv.id}:${today}`,
      refs: { invoice_id: inv.id, lead_id: lead.id, invoice_no: inv.invoice_no },
      variables: {
        ten_khach: lead.contact_name, ten_shop: shop, so_tien: vnd(Number(inv.amount_vnd)), ma_phieu: inv.invoice_no, han: dmy(inv.due_at),
        so_ngay_tre: Math.max(0, Math.floor((Date.now() - Date.parse(inv.due_at)) / 86_400_000)),
      },
    });
  }
  return { shop_name: shop, items: items.slice(0, 50), skipped: { no_email: noEmail, reminded_recently: recent } };
};

const csvCell = (v: string | number | null | undefined): string => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Last month's ledger as CSV (UTF-8 with BOM so Excel reads Vietnamese): money in (transactions) and issued invoices. */
export const monthLedgerCsv = async (workspaceId: string, periodParam?: string | null) => {
  const db = supabaseAdmin();
  const nowVn = new Date(Date.now() + 7 * 3_600_000);
  const defaultPeriod = new Date(Date.UTC(nowVn.getUTCFullYear(), nowVn.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  const period = periodParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(periodParam) ? periodParam : defaultPeriod;
  const [y, m] = period.split("-").map(Number);
  const from = new Date(`${period}-01T00:00:00${TZ_OFFSET}`).toISOString();
  const to = new Date(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01T00:00:00${TZ_OFFSET}`).toISOString();
  const [tx, inv] = await Promise.all([
    db.from("transactions").select("occurred_at, amount_vnd, reference, payer, channel, status, invoice_id").eq("workspace_id", workspaceId).eq("origin", "live").gte("occurred_at", from).lt("occurred_at", to).order("occurred_at"),
    db.from("invoices").select("id, invoice_no, amount_vnd, issued_at, due_at, status, paid_at").eq("workspace_id", workspaceId).eq("origin", "live").neq("status", "draft").gte("issued_at", from).lt("issued_at", to).order("issued_at"),
  ]);
  const rows: Array<Array<string | number | null>> = [["ngay", "loai", "so_tien_vnd", "ma_tham_chieu", "doi_tuong", "kenh", "trang_thai"]];
  let totalIn = 0;
  for (const t of (tx.data ?? []) as Array<{ occurred_at: string; amount_vnd: number; reference: string | null; payer: string | null; channel: string; status: string }>) {
    totalIn += Number(t.amount_vnd);
    rows.push([dmy(t.occurred_at), "thu", t.amount_vnd, t.reference, t.payer, t.channel, t.status]);
  }
  let totalInvoiced = 0;
  for (const i of (inv.data ?? []) as Array<{ invoice_no: string; amount_vnd: number; issued_at: string; status: string }>) {
    totalInvoiced += Number(i.amount_vnd);
    rows.push([dmy(i.issued_at), "hoa_don", i.amount_vnd, i.invoice_no, "", "", i.status]);
  }
  const csv = `﻿${rows.map((r) => r.map(csvCell).join(",")).join("\r\n")}\r\n`;
  const shop = await shopNameOf(workspaceId);
  const label = `${String(m).padStart(2, "0")}/${y}`;
  return {
    csv, period, filename: `so-cai-${period}.csv`, rows: rows.length - 1,
    variables: {
      ten_shop: shop, ky: label,
      tom_tat: [`- Tiền về: ${vnd(totalIn)} (${tx.data?.length ?? 0} giao dịch)`, `- Hoá đơn đã xuất: ${vnd(totalInvoiced)} (${inv.data?.length ?? 0} hoá đơn)`].join("\n"),
    },
  };
};

/* ------------------------------------------------------------------ event trigger: payment.received */

/**
 * A payment was reconciled to an invoice whose customer has an email: start the receipt pipeline (when the shop switched it on).
 * One receipt per transaction. Never throws: a receipt must never break the payment flow.
 */
export const triggerPaymentReceipt = async (workspaceId: string, o: { transactionId: string | null; invoiceId: string | null }): Promise<void> => {
  try {
    if (!o.transactionId && !o.invoiceId) return;
    const db = supabaseAdmin();
    const invId = o.invoiceId ?? ((await db.from("transactions").select("invoice_id").eq("id", o.transactionId as string).maybeSingle()).data as { invoice_id: string | null } | null)?.invoice_id ?? null;
    if (!invId) return;
    const { data: inv } = await db.from("invoices").select("id, invoice_no, amount_vnd, lead_id, paid_at").eq("id", invId).eq("workspace_id", workspaceId).maybeSingle();
    if (!inv?.lead_id) return;
    const { data: lead } = await db.from("leads").select("id, contact_name, email").eq("id", inv.lead_id).maybeSingle();
    if (!lead?.email) return;
    const tx = o.transactionId ? ((await db.from("transactions").select("amount_vnd, occurred_at").eq("id", o.transactionId).maybeSingle()).data as { amount_vnd: number; occurred_at: string } | null) : null;
    const shop = await shopNameOf(workspaceId);
    const key = `receipt:${o.transactionId ?? invId}`;
    await startPipelineRun(workspaceId, "email-payment-receipt", {
      to: String(lead.email).toLowerCase(), dedupe: key,
      refs: { invoice_id: invId, lead_id: lead.id, transaction_id: o.transactionId },
      variables: {
        ten_khach: lead.contact_name, ten_shop: shop, so_tien: vnd(Number(tx?.amount_vnd ?? inv.amount_vnd)), ma_phieu: inv.invoice_no,
        ngay: dmy(tx?.occurred_at ?? inv.paid_at ?? new Date()),
      },
    }, key);
  } catch (e) {
    console.error("payment receipt trigger failed:", e instanceof Error ? e.message : e);
  }
};
