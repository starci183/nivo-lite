import "server-only";
import { logEvidence } from "./core";
import { runWork, type EngineCtx } from "./engine";
import { notifyManagers } from "./module-shifts-notify";
import { loadSetup, nameOf, shiftLine, toShift } from "./module-shifts-data";
import { addDays, clockVn, instantOf, toMin } from "./module-shifts-types";
import { sendWorkspaceEmailSafe } from "./module-shifts-mail";
import { supabaseAdmin } from "./supabase/admin";

/**
 * The minute work of the module, called from the automation tick (src/lib/automation-engine.ts runTick, every minute):
 *  - shifts.remind jobs (queued when a schedule is published): remind_shift through the authority gate, only when the automation "shifts_shift_reminder" is on;
 *  - shifts.noshow jobs: an alert to the owner / managers when nobody has checked in `noshow_minutes` after a shift started (only when "shifts_shift_reminder" is on);
 *  - the monthly summary of hours x wage (automation "shifts_month_close"), once per month.
 * Jobs are claimed with engine_claim_jobs under the worker name "app-shifts" (the engine does not handle shifts.* kinds), so a job runs once.
 */
type R = Record<string, unknown>;
const WORKER = "app-shifts";
const KINDS = ["shifts.remind", "shifts.noshow"];

const ctxOf = (ws: string): EngineCtx => ({ db: supabaseAdmin(), ws, actor: "NIVO", locale: "vi" });

type Pipeline = { enabled: boolean; config: Record<string, unknown> };
const pipelineOf = async (ws: string, key: string): Promise<Pipeline | null> => {
  const { data } = await supabaseAdmin().from("automation_pipelines").select("enabled, config").eq("workspace_id", ws).eq("template_key", key).maybeSingle();
  const r = data as { enabled: boolean; config: Record<string, unknown> } | null;
  return r && r.enabled ? r : null;
};

const doRemind = async (ws: string, shiftId: string): Promise<string> => {
  const c = ctxOf(ws);
  if (!(await pipelineOf(ws, "shifts_shift_reminder"))) return "skipped: automation off";
  const { data } = await c.db.from("shifts_shifts").select("*").eq("id", shiftId).maybeSingle();
  const row = data as R | null;
  if (!row || !row.staff_id || !["published", "swapped"].includes(String(row.status))) return "skipped: shift not active";
  const setup = await loadSetup(c.db, ws, { withPay: false });
  const sh = toShift(row);
  const item = await runWork(c, {
    action: "remind_shift", subject_type: "inbound", subject_id: null, dedupeKey: `remind_shift:${shiftId}:${sh.staffId}`, origin: "live", preset: true,
    seed: { summary: `Nhắc ${nameOf(setup, sh.staffId)} ca ${shiftLine(setup, sh)}`, fields: { shift_id: shiftId, staff_id: sh.staffId } },
  });
  return `${item.status}${item.decided_path ? `/${item.decided_path}` : ""}`;
};

const doNoShow = async (ws: string, shiftId: string, now: Date): Promise<string> => {
  const c = ctxOf(ws);
  if (!(await pipelineOf(ws, "shifts_shift_reminder"))) return "skipped: automation off";
  const { data } = await c.db.from("shifts_shifts").select("*").eq("id", shiftId).maybeSingle();
  const row = data as R | null;
  if (!row || !row.staff_id || !["published", "swapped"].includes(String(row.status))) return "skipped: shift not active";
  const sh = toShift(row);
  if (instantOf(sh.date, toMin(sh.end)).getTime() <= now.getTime()) return "skipped: shift is over";
  const att = await c.db.from("shifts_attendance").select("id", { count: "exact", head: true }).eq("shift_id", shiftId);
  if ((att.count ?? 0) > 0) return "checked in";
  const had = await c.db.from("shifts_notifications").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("shift_id", shiftId).eq("kind", "no_show");
  if ((had.count ?? 0) > 0) return "already alerted";
  const setup = await loadSetup(c.db, ws, { withPay: false });
  const mins = Math.max(1, Math.round((now.getTime() - instantOf(sh.date, toMin(sh.start)).getTime()) / 60_000));
  await notifyManagers(c, "no_show", `${nameOf(setup, sh.staffId)} chưa vào ca sau ${mins} phút: ${shiftLine(setup, sh)}. Bạn có thể gọi hỏi hoặc tìm người thay.`, { shiftId });
  await logEvidence(c.db, ws, { kind: "shifts.no_show", actor: "NIVO", summary: `${nameOf(setup, sh.staffId)} chưa vào ca ${sh.start}–${sh.end} ngày ${sh.date}`, evidence: shiftId });
  return "alerted";
};

/** Claim and run due shifts.* jobs. Returns how many ran. */
const runJobs = async (now: Date): Promise<number> => {
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("engine_claim_jobs", { p_worker: WORKER, p_kinds: KINDS, p_limit: 20, p_lease_seconds: 90 });
  if (error || !data) return 0;
  let n = 0;
  for (const j of data as Array<{ id: string; workspace_id: string | null; kind: string; payload: { shift_id?: string } }>) {
    try {
      if (!j.workspace_id || !j.payload.shift_id) throw new Error("job without workspace or shift");
      const result = j.kind === "shifts.remind" ? await doRemind(j.workspace_id, j.payload.shift_id) : await doNoShow(j.workspace_id, j.payload.shift_id, now);
      await db.rpc("engine_complete_job", { p_job: j.id, p_worker: WORKER, p_result: { result } });
    } catch (e) {
      await db.rpc("engine_fail_job", { p_job: j.id, p_worker: WORKER, p_error: e instanceof Error ? e.message : String(e) });
    }
    n++;
  }
  return n;
};

/* ------------------------------------------------------------------ the monthly close */

const csv = (rows: Array<Array<string | number>>) => rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");

/** Hours x wage of one month from published shifts (checked-in hours are noted separately, since check-in is optional). */
export const monthSummary = async (ws: string, month: string): Promise<{ rows: Array<{ name: string; shifts: number; hours: number; checked: number; wage: number; cost: number }>; total: number; hours: number }> => {
  const db = supabaseAdmin();
  const from = `${month}-01`;
  const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const to = `${month}-${String(last).padStart(2, "0")}`;
  const setup = await loadSetup(db, ws);
  const shifts = (((await db.from("shifts_shifts").select("*").eq("workspace_id", ws).gte("shift_date", from).lte("shift_date", to).in("status", ["published", "swapped"]).not("staff_id", "is", null)).data ?? []) as Array<R>).map(toShift);
  const att = new Set((((await db.from("shifts_attendance").select("shift_id").eq("workspace_id", ws)).data ?? []) as Array<{ shift_id: string }>).map((a) => a.shift_id));
  const rows = setup.staff.map((p) => {
    const mine = shifts.filter((s) => s.staffId === p.id);
    const hours = mine.reduce((n, s) => n + (toMin(s.end) - toMin(s.start)) / 60, 0);
    const checked = mine.filter((s) => att.has(s.id)).reduce((n, s) => n + (toMin(s.end) - toMin(s.start)) / 60, 0);
    return { name: p.name, shifts: mine.length, hours: Math.round(hours * 10) / 10, checked: Math.round(checked * 10) / 10, wage: p.wage, cost: Math.round(hours * p.wage) };
  }).filter((r) => r.shifts > 0);
  return { rows, total: rows.reduce((n, r) => n + r.cost, 0), hours: rows.reduce((n, r) => n + r.hours, 0) };
};

/** Close the month for one workspace: an Office summary for the owner, evidence for Accounting, and a CSV by email when mail can be sent. Idempotent per month. */
export const closeMonth = async (ws: string, month: string, opts: { force?: boolean; noEmail?: boolean } = {}): Promise<{ done: boolean; emailed: boolean; total: number }> => {
  const c = ctxOf(ws);
  const marker = `[payroll:${month}]`;
  if (!opts.force) {
    const had = await c.db.from("shifts_notifications").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("kind", "payroll").like("body", `${marker}%`);
    if ((had.count ?? 0) > 0) return { done: false, emailed: false, total: 0 };
  }
  const s = await monthSummary(ws, month);
  const money = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;
  const lines = s.rows.map((r) => `${r.name}: ${r.shifts} ca, ${r.hours} giờ × ${money(r.wage)} = ${money(r.cost)}`);
  const body = `${marker} Chốt công tháng ${month.slice(5)}/${month.slice(0, 4)}: ${s.rows.length} người, ${Math.round(s.hours * 10) / 10} giờ, tổng lương ước tính ${money(s.total)}.\n${lines.join("\n")}\nSố giờ tính theo lịch đã đăng (vào ca là tùy chọn). Kế toán nhận bản này làm căn cứ chi lương.`;
  let emailed = false;
  const owner = opts.noEmail ? null : await ownerEmail(ws);
  if (owner) {
    const file = csv([["Nhân viên", "Số ca", "Giờ theo lịch", "Giờ đã vào ca", "Lương/giờ", "Thành tiền"], ...s.rows.map((r) => [r.name, r.shifts, r.hours, r.checked, r.wage, r.cost]), ["Tổng", "", Math.round(s.hours * 10) / 10, "", "", s.total]]);
    const r = await sendWorkspaceEmailSafe({ workspaceId: ws, to: owner, subject: `Chốt công tháng ${month.slice(5)}/${month.slice(0, 4)}`, text: body.replace(marker, "").trim(), csvName: `cong-${month}.csv`, csv: file });
    emailed = r;
  }
  await notifyManagers(c, "payroll", `${body}${emailed ? "\nĐã gửi file CSV tới email của chủ." : ""}`);
  await logEvidence(c.db, ws, { kind: "shifts.payroll", actor: "NIVO", summary: `Chốt công tháng ${month}: ${s.rows.length} người, ${money(s.total)}`, evidence: JSON.stringify(s.rows) });
  return { done: true, emailed, total: s.total };
};

const ownerEmail = async (ws: string): Promise<string | null> => {
  const db = supabaseAdmin();
  const { data } = await db.from("workspace_members").select("user_id").eq("workspace_id", ws).eq("role", "owner").eq("status", "active").order("created_at").limit(1);
  const id = ((data ?? [])[0] as { user_id: string } | undefined)?.user_id;
  if (!id) return null;
  const u = await db.auth.admin.getUserById(id);
  return u.data.user?.email ?? null;
};

const runMonthly = async (now: Date): Promise<number> => {
  const db = supabaseAdmin();
  const { data } = await db.from("automation_pipelines").select("workspace_id, config").eq("template_key", "shifts_month_close").eq("enabled", true);
  let n = 0;
  const clock = clockVn(now);
  for (const p of (data ?? []) as Array<{ workspace_id: string; config: { day?: number; time?: string } }>) {
    const day = Math.min(28, Math.max(1, Number(p.config?.day) || 1));
    const [h, m] = String(p.config?.time ?? "09:00").split(":").map(Number);
    if (Number(clock.date.slice(8, 10)) < day || clock.minute < (h || 0) * 60 + (m || 0)) continue;
    const prev = addDays(`${clock.date.slice(0, 7)}-01`, -1).slice(0, 7);
    try {
      const r = await closeMonth(p.workspace_id, prev);
      if (r.done) n++;
    } catch (e) {
      console.error("shifts month close failed:", e instanceof Error ? e.message : e);
    }
  }
  return n;
};

/** Entry point called every minute by the automation tick. Never throws. */
export const runShiftsTick = async (now: Date = new Date()): Promise<number> => {
  try {
    const jobs = await runJobs(now);
    const monthly = await runMonthly(now);
    return jobs + monthly;
  } catch (e) {
    console.error("shifts tick failed:", e instanceof Error ? e.message : e);
    return 0;
  }
};


