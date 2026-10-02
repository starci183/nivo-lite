import "server-only";
import { generateWithOpenClaw } from "./openclaw-generate";
import { logEvidence } from "./core";
import { runWork, type EngineCtx } from "./engine";
import { solveWeek } from "./module-shifts-solver";
import {
  DEFAULT_SETTINGS, currentSchedule, dayLabel, loadEnv, loadSchedules, loadSetup, loadShifts, nameOf, positionOf, shiftLine, toShift, weekLabel,
  type ScheduleRow, type Setup,
} from "./module-shifts-data";
import { addDays, clockVn, coverageOf, instantOf, isAvailable, laborCost, onLeave, segOf, toMin, violationsForSegs, violationsOfShifts, type Env, type Shift, type ShiftStaff, type Violation, weekDates, mondayOf } from "./module-shifts-types";
import { supabaseAdmin } from "./supabase/admin";
import { VIOLATION_TEXT, affectedShifts, swapFindings, type SwapInput } from "./module-shifts-rules";

/**
 * Server logic of the shifts module: propose a week with the solver, write the explanation with OpenClaw, check swaps and leave against the
 * rules, and build the seeds of the gated actions. Customer / staff-facing sends are NOT here (module-shifts-notify.ts, called from performers
 * after the authority gate). Every function takes the engine context so the minute tick (service role) and the signed-in owner share it.
 */
type R = Record<string, unknown>;

const chunk = <T,>(a: ReadonlyArray<T>, n: number): Array<Array<T>> => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/* ------------------------------------------------------------------ propose */

export type Proposed = { scheduleId: string; version: number; ms: number; costVnd: number; shiftCount: number; openCount: number; shortages: number; iterations: number };

/** Run the solver for a week and save the result as a new DRAFT version (older drafts of that week become superseded). Never publishes. */
export const proposeWeek = async (c: EngineCtx, monday: string, by: string): Promise<Proposed> => {
  const week = mondayOf(monday);
  const setup = await loadSetup(c.db, c.ws);
  if (!setup.staff.some((p) => p.active)) throw new Error("Chưa có nhân viên nào. Thêm nhân viên trước khi đề xuất lịch.");
  if (!setup.blocks.length) throw new Error("Chưa có nhu cầu theo ca. Thêm số người cần mỗi khung giờ trước khi đề xuất lịch.");
  const env = await loadEnv(c.db, c.ws, week, setup);
  const out = solveWeek({ monday: week, staff: setup.staff, blocks: setup.blocks, avail: env.avail, leaves: env.leaves, prior: env.prior, overtimeHoursWeek: setup.settings.overtimeHoursWeek });
  const cells = coverageOf(setup.blocks, week, out.shifts);
  const summary = {
    short: cells.filter((x) => x.status === "short").length, ok: cells.filter((x) => x.status === "ok").length, over: cells.filter((x) => x.status === "over").length,
    shifts: out.report.shiftCount, open: out.report.openCount, hoursByStaff: out.report.hoursByStaff,
  };
  const prev = await c.db.from("shifts_schedules").select("version").eq("workspace_id", c.ws).eq("week_start", week).order("version", { ascending: false }).limit(1);
  const version = ((prev.data ?? [])[0] as { version: number } | undefined)?.version ?? 0;
  await c.db.from("shifts_schedules").update({ status: "superseded" }).eq("workspace_id", c.ws).eq("week_start", week).eq("status", "draft");
  const ins = await c.db.from("shifts_schedules").insert({
    workspace_id: c.ws, week_start: week, version: version + 1, status: "draft", source: "solver", cost_vnd: out.report.costVnd, summary, solver_ms: out.report.ms, created_by: by,
    evidence: { solver: { ms: out.report.ms, iterations: out.report.iterations, shortages: out.report.shortages, askCandidates: out.report.askCandidates, costVnd: out.report.costVnd }, explanation: null },
  }).select("id").single();
  if (ins.error) throw new Error(ins.error.message);
  const scheduleId = (ins.data as { id: string }).id;
  for (const part of chunk(out.shifts, 200)) {
    const res = await c.db.from("shifts_shifts").insert(part.map((s) => ({
      workspace_id: c.ws, schedule_id: scheduleId, shift_date: s.date, start_time: s.start, end_time: s.end, position_id: s.positionId, staff_id: s.staffId, status: "draft", source: "solver",
    })));
    if (res.error) throw new Error(res.error.message);
  }
  await logEvidence(c.db, c.ws, {
    kind: "shifts.proposed", actor: by, summary: `Đề xuất lịch tuần ${weekLabel(week)} (bản ${version + 1}): ${out.report.shiftCount} ca, ${out.report.openCount} ca trống, ${out.report.ms} ms`,
    evidence: JSON.stringify({ costVnd: out.report.costVnd, shortages: out.report.shortages.length, iterations: out.report.iterations }),
  });
  return { scheduleId, version: version + 1, ms: out.report.ms, costVnd: out.report.costVnd, shiftCount: out.report.shiftCount, openCount: out.report.openCount, shortages: out.report.shortages.length, iterations: out.report.iterations };
};

/* ------------------------------------------------------------------ explanation (OpenClaw writes words, never the schedule) */

/** OpenClaw sometimes adds Markdown despite the instruction: the screen shows plain text. */
const plain = (s: string): string => s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#{1,6}\s*/gm, "").replace(/^\s*[*•]\s+/gm, "- ").replace(/`/g, "").trim();

const money = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;

/** What the solver found, as plain Vietnamese lines. This is also the fallback text when OpenClaw cannot answer. */
export const factsOf = (setup: Setup, sched: ScheduleRow, shifts: ReadonlyArray<Shift>): Array<string> => {
  const ev = sched.evidence as { solver?: { shortages?: Array<{ date: string; start: string; end: string; positionId: string; missing: number }>; askCandidates?: Array<{ date: string; staffId: string; blockId: string; why: string }> } };
  const lines: Array<string> = [`Chi phí lương ước tính cả tuần: ${money(sched.costVnd)}.`];
  const short = ev.solver?.shortages ?? [];
  if (!short.length) lines.push("Mọi khung giờ đều đủ số người tối thiểu.");
  for (const s of short) {
    const asks = (ev.solver?.askCandidates ?? []).filter((a) => a.date === s.date && a.blockId && short.some((x) => x.date === a.date)).slice(0, 3);
    const who = asks.map((a) => `${nameOf(setup, a.staffId)} (${a.why === "unavailable" ? "đã báo bận" : a.why === "over_hours" ? "gần hết giờ tuần" : "chưa đủ giờ nghỉ"})`);
    lines.push(`${dayLabel(s.date)} thiếu ${s.missing} ${positionOf(setup, s.positionId)?.name ?? "người"} ${s.start}–${s.end}${who.length ? `. Có thể hỏi: ${who.join(", ")}` : ""}.`);
  }
  const hours = Object.entries((sched.summary as { hoursByStaff?: Record<string, number> }).hoursByStaff ?? {}).sort((a, b) => b[1] - a[1]);
  if (hours.length) lines.push(`Giờ làm: ${hours.map(([id, h]) => `${nameOf(setup, id)} ${h}h`).join(", ")}.`);
  void shifts;
  return lines;
};

/** Ask OpenClaw to explain the saved draft and suggest what to ask people. The schedule is not changed by it. */
export const explainSchedule = async (c: EngineCtx, scheduleId: string): Promise<{ source: "openclaw" | "fallback"; text: string; ms: number }> => {
  const t0 = Date.now();
  const setup = await loadSetup(c.db, c.ws);
  const { data } = await c.db.from("shifts_schedules").select("*").eq("id", scheduleId).eq("workspace_id", c.ws).maybeSingle();
  if (!data) throw new Error("Không tìm thấy bản lịch.");
  const row = data as R;
  const sched = (await loadSchedules(c.db, c.ws, String(row.week_start))).find((x) => x.id === scheduleId);
  if (!sched) throw new Error("Không tìm thấy bản lịch.");
  const shifts = await loadShifts(c.db, c.ws, scheduleId);
  const facts = factsOf(setup, sched, shifts);
  const r = await generateWithOpenClaw({
    workspaceId: c.ws, purpose: "shifts_explain", kind: "engine", module: "shifts", timeoutMs: 45_000,
    messages: [
      { role: "system", content: "Bạn là trợ lý xếp lịch ca của một cửa hàng. Viết tiếng Việt đơn giản, thân thiện, ngắn gọn (tối đa 6 gạch đầu dòng, mỗi dòng bắt đầu bằng dấu gạch ngang). Chỉ dùng văn bản thuần: không dùng dấu * hay # hay định dạng Markdown. Chỉ dùng đúng các dữ kiện được đưa; KHÔNG bịa người, giờ, số liệu; KHÔNG sửa lịch và không hứa gì thay chủ. Mở đầu bằng một câu tóm tắt, sau đó nêu ca thiếu người kèm gợi ý hỏi ai (nếu có dữ kiện), cuối cùng nhắc chủ rằng lịch chỉ gửi tới nhân viên sau khi chủ duyệt đăng." },
      { role: "user", content: `Tuần ${weekLabel(sched.weekStart)}. Kết quả bộ xếp lịch:\n${facts.map((x) => `- ${x}`).join("\n")}\nViết phần giải thích và đề xuất cho chủ cửa hàng.` },
    ],
  });
  const source = r.ok && r.output.trim() ? "openclaw" : "fallback";
  const text = r.ok && r.output.trim() ? r.output.trim() : facts.join("\n");
  const ev = { ...(sched.evidence as R), explanation: { source, ms: Date.now() - t0, ...(r.ok ? { timings: r.timings } : { reason: r.reason }) } };
  await c.db.from("shifts_schedules").update({ explanation: text, evidence: ev }).eq("id", scheduleId).eq("workspace_id", c.ws);
  return { source, text, ms: Date.now() - t0 };
};

/* ------------------------------------------------------------------ editing a draft */

/** Move a draft shift to another person (or to "ca trống"). Rule breaks are returned as warnings, not blocked: the owner decides. */
export const reassignShift = async (c: EngineCtx, shiftId: string, staffId: string | null): Promise<Array<string>> => {
  const { data } = await c.db.from("shifts_shifts").select("*, shifts_schedules(status, week_start)").eq("id", shiftId).eq("workspace_id", c.ws).maybeSingle();
  const row = data as (R & { shifts_schedules: { status: string; week_start: string } | null }) | null;
  if (!row) throw new Error("Không tìm thấy ca.");
  if (row.shifts_schedules?.status !== "draft") throw new Error("Chỉ sửa được lịch nháp. Lịch đã đăng đổi qua yêu cầu đổi ca.");
  const upd = await c.db.from("shifts_shifts").update({ staff_id: staffId, source: "manual" }).eq("id", shiftId).eq("workspace_id", c.ws);
  if (upd.error) throw new Error(upd.error.message);
  if (!staffId) return [];
  const setup = await loadSetup(c.db, c.ws);
  const env = await loadEnv(c.db, c.ws, row.shifts_schedules.week_start, setup);
  const all = await loadShifts(c.db, c.ws, String(row.schedule_id));
  const v = violationsOfShifts(env, all).get(shiftId) ?? [];
  return v.map((x) => VIOLATION_TEXT[x.kind]);
};

/** Add a manual shift to a draft. */
export const addDraftShift = async (c: EngineCtx, scheduleId: string, s: { date: string; start: string; end: string; positionId: string; staffId: string | null }): Promise<string> => {
  const { data } = await c.db.from("shifts_schedules").select("status").eq("id", scheduleId).eq("workspace_id", c.ws).maybeSingle();
  if ((data as { status?: string } | null)?.status !== "draft") throw new Error("Chỉ thêm ca vào lịch nháp.");
  if (toMin(s.end) <= toMin(s.start)) throw new Error("Giờ kết thúc phải sau giờ bắt đầu.");
  const ins = await c.db.from("shifts_shifts").insert({ workspace_id: c.ws, schedule_id: scheduleId, shift_date: s.date, start_time: s.start, end_time: s.end, position_id: s.positionId, staff_id: s.staffId, status: "draft", source: "manual" }).select("id").single();
  if (ins.error) throw new Error(ins.error.message);
  return (ins.data as { id: string }).id;
};

export const removeDraftShift = async (c: EngineCtx, shiftId: string): Promise<void> => {
  const { data } = await c.db.from("shifts_shifts").select("status").eq("id", shiftId).eq("workspace_id", c.ws).maybeSingle();
  if ((data as { status?: string } | null)?.status !== "draft") throw new Error("Chỉ xóa được ca của lịch nháp.");
  await c.db.from("shifts_shifts").delete().eq("id", shiftId).eq("workspace_id", c.ws);
};

/* ------------------------------------------------------------------ publish seed (the gate decides) */

/** What the owner is asked to approve: the week in one line plus the facts the gate shows. */
export const publishProposal = async (c: EngineCtx, scheduleId: string) => {
  const setup = await loadSetup(c.db, c.ws);
  const { data } = await c.db.from("shifts_schedules").select("*").eq("id", scheduleId).eq("workspace_id", c.ws).maybeSingle();
  if (!data) throw new Error("Không tìm thấy bản lịch.");
  const row = data as R;
  if (row.status !== "draft") throw new Error("Bản này không còn là lịch nháp.");
  const week = String(row.week_start);
  const sched = (await loadSchedules(c.db, c.ws, week)).find((x) => x.id === scheduleId)!;
  const shifts = await loadShifts(c.db, c.ws, scheduleId);
  const env = await loadEnv(c.db, c.ws, week, setup);
  const cells = coverageOf(setup.blocks, week, shifts);
  const short = cells.filter((x) => x.status === "short").length;
  const open = shifts.filter((s) => !s.staffId).length;
  const broken = violationsOfShifts(env, shifts).size;
  const people = new Set(shifts.filter((s) => s.staffId).map((s) => s.staffId)).size;
  const cost = laborCost(env, shifts).total;
  return {
    summary: `Đăng lịch tuần ${weekLabel(week)}: ${shifts.length - open} ca cho ${people} người, ước tính lương ${money(cost)}${open ? `, còn ${open} ca trống` : ""}${short ? `, ${short} khung giờ còn thiếu` : ""}${broken ? `, ${broken} ca đang vi phạm quy tắc` : ""}`,
    fields: { schedule_id: scheduleId, week_start: week, version: sched.version, shifts: shifts.length - open, open_shifts: open, people, cost_vnd: cost, short_blocks: short, rule_breaks: broken },
  };
};

export const requestPublish = async (c: EngineCtx, scheduleId: string) => {
  const seed = await publishProposal(c, scheduleId);
  const prior = await c.db.from("work_items").select("id", { count: "exact", head: true }).eq("workspace_id", c.ws).eq("action", "publish_schedule").like("dedupe_key", `publish_schedule:${scheduleId}%`);
  const n = prior.count ?? 0;
  const item = await runWork(c, {
    action: "publish_schedule", subject_type: "inbound", subject_id: null, dedupeKey: `publish_schedule:${scheduleId}${n ? `:${n}` : ""}`, origin: "live", preset: true, seed,
  });
  await c.db.from("shifts_schedules").update({ work_item_id: item.id }).eq("id", scheduleId).eq("workspace_id", c.ws);
  return item;
};

/* ------------------------------------------------------------------ swaps and claims: rules first, then the gate */

export const requestSwapWork = async (c: EngineCtx, swapId: string, req: SwapInput) => {
  const f = await swapFindings(c.db, c.ws, req);
  const setup = await loadSetup(c.db, c.ws, { withPay: false });
  const line = f.shift ? shiftLine(setup, f.shift) : "ca";
  const from = nameOf(setup, req.fromStaffId);
  const to = nameOf(setup, req.toStaffId);
  const summary = req.kind === "swap" ? `${from} xin đổi ${line} cho ${to}` : `${to} xin nhận ca trống ${line}`;
  await c.db.from("shifts_swap_requests").update({ checks: f.reasons }).eq("id", swapId);
  const item = await runWork(c, {
    action: "approve_swap", subject_type: "inbound", subject_id: null, dedupeKey: `approve_swap:${swapId}`, origin: "live", preset: true,
    // Outside the rules (other position, a rule broken, too late) never goes through on its own: the owner decides.
    forceAsk: f.reasons.length ? "over_authority" : undefined,
    seed: { summary: f.reasons.length ? `${summary}. Cần chủ duyệt: ${f.reasons.join(" ")}` : `${summary}. Trong quy tắc: cùng vị trí, không vi phạm giờ làm.`, fields: { swap_id: swapId, shift_id: req.shiftId, kind: req.kind, from_staff_id: req.fromStaffId, to_staff_id: req.toStaffId, in_rules: f.reasons.length === 0 ? 1 : 0 } },
  });
  await c.db.from("shifts_swap_requests").update({ work_item_id: item.id }).eq("id", swapId);
  return item;
};

export const requestLeaveWork = async (c: EngineCtx, leaveId: string) => {
  const setup = await loadSetup(c.db, c.ws, { withPay: false });
  const { data } = await c.db.from("shifts_leave_requests").select("*").eq("id", leaveId).eq("workspace_id", c.ws).maybeSingle();
  if (!data) throw new Error("Không tìm thấy đơn xin nghỉ.");
  const r = data as R;
  const affected = await affectedShifts(c.db, c.ws, String(r.staff_id), String(r.from_date), String(r.to_date));
  const range = r.from_date === r.to_date ? dayLabel(String(r.from_date)) : `${dayLabel(String(r.from_date))} – ${dayLabel(String(r.to_date))}`;
  const item = await runWork(c, {
    action: "approve_leave", subject_type: "inbound", subject_id: null, dedupeKey: `approve_leave:${leaveId}`, origin: "live", preset: true,
    seed: { summary: `${nameOf(setup, String(r.staff_id))} xin nghỉ ${range}${r.reason ? ` (${String(r.reason)})` : ""}. ${affected.length ? `Ảnh hưởng ${affected.length} ca.` : "Không có ca nào bị ảnh hưởng."}`, fields: { leave_id: leaveId, staff_id: String(r.staff_id), affected: affected.length } },
  });
  await c.db.from("shifts_leave_requests").update({ work_item_id: item.id }).eq("id", leaveId);
  return item;
};

export type { Env, ScheduleRow, Setup };
export { DEFAULT_SETTINGS, currentSchedule, isAvailable, onLeave, clockVn, weekDates, supabaseAdmin };
