import "server-only";
import type { EngineCtx, Performer } from "@/lib/engine";
import { logEvidence } from "@/lib/core";
import { dayLabel, loadSetup, nameOf, positionOf, shiftLine, toShift, weekLabel, type Setup } from "@/lib/module-shifts-data";
import { notifyManagers, notifyStaff } from "@/lib/module-shifts-notify";
import { affectedShifts, coverCandidates, swapFindings } from "@/lib/module-shifts-rules";
import { instantOf, toMin, type Shift, type ShiftStaff } from "@/lib/module-shifts-types";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Performers of the four shifts actions. They run ONLY after the authority gate let the action through (automatically under the owner's
 * rule, or after a person approved it in the gate). Staff messages and writes to the schedule happen here and nowhere else.
 * Writes use the service role: the gate already decided and the decider may be a manager whose RLS cannot touch notification or job tables.
 */
type R = Record<string, unknown>;
const f = (p: { fields: Record<string, string | number | null> }, k: string) => String(p.fields?.[k] ?? "");
const pass: Performer["prepare"] = async (_c, item) => ({ proposal: { ...item.proposal, summary: item.proposal?.summary ?? "", fields: item.proposal?.fields ?? {} } });
const staffOf = (setup: Setup, id: string | null): ShiftStaff | undefined => setup.staff.find((p) => p.id === id);
const asShift = (r: R) => toShift(r);

/** Queue the reminder and the no-show check of one shift as engine jobs (kind shifts.*), run by the minute tick. */
export const scheduleShiftJobs = async (ws: string, sh: Shift, remindMinutes: number, noshowMinutes: number, now = new Date()): Promise<number> => {
  const db = supabaseAdmin();
  const start = instantOf(sh.date, toMin(sh.start));
  const end = instantOf(sh.date, toMin(sh.end));
  if (end.getTime() <= now.getTime() || !sh.staffId) return 0;
  const remindAt = new Date(Math.max(now.getTime(), start.getTime() - remindMinutes * 60_000));
  let n = 0;
  if (start.getTime() > now.getTime()) {
    const r = await db.rpc("engine_enqueue", { p_workspace: ws, p_kind: "shifts.remind", p_payload: { shift_id: sh.id }, p_dedupe_key: `shifts.remind:${sh.id}`, p_run_at: remindAt.toISOString(), p_max_attempts: 3 });
    if (!r.error) n++;
  }
  const check = new Date(start.getTime() + noshowMinutes * 60_000);
  const c = await db.rpc("engine_enqueue", { p_workspace: ws, p_kind: "shifts.noshow", p_payload: { shift_id: sh.id }, p_dedupe_key: `shifts.noshow:${sh.id}`, p_run_at: check.toISOString(), p_max_attempts: 3 });
  if (!c.error) n++;
  return n;
};

/* ------------------------------------------------------------------ publish_schedule */

const publishSchedule: Performer = {
  prepare: pass,
  perform: async (c: EngineCtx, item, p, by) => {
    const scheduleId = f(p, "schedule_id");
    const db = supabaseAdmin();
    const { data } = await db.from("shifts_schedules").select("*").eq("id", scheduleId).eq("workspace_id", c.ws).maybeSingle();
    const sched = data as R | null;
    if (!sched) throw new Error("Không tìm thấy bản lịch để đăng.");
    const week = String(sched.week_start);
    if (sched.status === "published") return { summary: `Lịch tuần ${weekLabel(week)} đã được đăng trước đó.`, evidence: "captured" };
    if (sched.status !== "draft") throw new Error("Bản này không còn là lịch nháp.");
    const setup = await loadSetup(db, c.ws, { withPay: false });
    const now = new Date();

    // The older published version of the week is replaced: its shifts stop counting (and stop reminding).
    const olds = (((await db.from("shifts_schedules").select("id").eq("workspace_id", c.ws).eq("week_start", week).eq("status", "published")).data ?? []) as Array<{ id: string }>).map((x) => x.id);
    if (olds.length) {
      await db.from("shifts_schedules").update({ status: "superseded" }).in("id", olds);
      await db.from("shifts_shifts").update({ status: "cancelled" }).in("schedule_id", olds).in("status", ["published", "swapped"]);
    }
    await db.from("shifts_shifts").update({ status: "published" }).eq("schedule_id", scheduleId).eq("status", "draft");
    const ev = { ...((sched.evidence as R) ?? {}), publish: { by: by.name, work_item_id: item.id, at: now.toISOString(), path: item.decided_path ?? null } };
    await db.from("shifts_schedules").update({ status: "published", published_at: now.toISOString(), work_item_id: item.id, evidence: ev }).eq("id", scheduleId);

    const shifts = (((await db.from("shifts_shifts").select("*").eq("schedule_id", scheduleId).eq("status", "published").order("shift_date").order("start_time")).data ?? []) as Array<R>).map(asShift);
    const by_staff = new Map<string, Array<Shift>>();
    for (const s of shifts) if (s.staffId) by_staff.set(s.staffId, [...(by_staff.get(s.staffId) ?? []), s]);

    let sent = 0;
    for (const [id, list] of by_staff) {
      const person = staffOf(setup, id);
      if (!person) continue;
      const lines = list.map((s) => `• ${shiftLine(setup, s)}`).join("\n");
      const hours = Math.round((list.reduce((n, s) => n + (toMin(s.end) - toMin(s.start)), 0) / 60) * 10) / 10;
      const body = `Lịch làm tuần ${weekLabel(week)} của bạn (${list.length} ca, ${hours} giờ):\n${lines}\nBạn xin đổi ca hoặc xin nghỉ trong mục Lịch của tôi.`;
      await notifyStaff({ ...c, db }, person, "publish", body, { scheduleId, workItemId: item.id });
      sent++;
    }
    let jobs = 0;
    // The automation's own settings (when the owner set them) win over the module defaults.
    const pl = ((await db.from("automation_pipelines").select("config").eq("workspace_id", c.ws).eq("template_key", "shifts_shift_reminder").maybeSingle()).data as { config?: Record<string, unknown> } | null)?.config ?? {};
    const remindMin = Number(pl.beforeMinutes) > 0 ? Number(pl.beforeMinutes) : setup.settings.remindMinutes;
    const noshowMin = Number(pl.noShowMinutes) > 0 ? Number(pl.noShowMinutes) : setup.settings.noshowMinutes;
    for (const s of shifts) jobs += await scheduleShiftJobs(c.ws, s, remindMin, noshowMin, now);
    const open = shifts.filter((s) => !s.staffId);
    if (open.length) await notifyManagers({ ...c, db }, "gap", `Còn ${open.length} ca trống tuần ${weekLabel(week)}: ${open.slice(0, 4).map((s) => shiftLine(setup, s)).join("; ")}${open.length > 4 ? "…" : ""}. Nhân viên có thể đăng ký ở mục Lịch của tôi.`, { scheduleId });
    await logEvidence(db, c.ws, { work_item_id: item.id, kind: "shifts.published", actor: by.name, summary: `Đã đăng lịch tuần ${weekLabel(week)}: ${sent} người nhận, ${jobs} việc nhắc đã xếp lịch`, evidence: JSON.stringify({ schedule_id: scheduleId, shifts: shifts.length, open: open.length }) });
    return { summary: `Đã đăng lịch tuần ${weekLabel(week)}: ${sent} nhân viên đã nhận lịch, ${jobs} việc nhắc đã xếp.`, evidence: "captured", href: "/m/shifts/workbench", detail: `Bản ${String(sched.version)}` };
  },
  onReject: async (c, _item, p) => {
    await logEvidence(c.db, c.ws, { kind: "shifts.publish_declined", actor: c.actor, summary: `Chủ chưa đồng ý đăng lịch tuần ${f(p, "week_start")}; bản nháp vẫn còn để sửa.` });
  },
};

/* ------------------------------------------------------------------ approve_swap */

const approveSwap: Performer = {
  prepare: pass,
  perform: async (c, item, p, by) => {
    const db = supabaseAdmin();
    const swapId = f(p, "swap_id");
    const { data } = await db.from("shifts_swap_requests").select("*").eq("id", swapId).eq("workspace_id", c.ws).maybeSingle();
    const req = data as R | null;
    if (!req) throw new Error("Không tìm thấy yêu cầu đổi ca.");
    if (req.status === "approved") return { summary: "Yêu cầu đổi ca này đã được duyệt trước đó.", evidence: "captured" };
    if (req.status !== "pending") throw new Error("Yêu cầu này đã được xử lý.");
    const kind = req.kind === "claim" ? "claim" : "swap";
    const from = (req.from_staff_id as string | null) ?? null;
    const to = String(req.to_staff_id);
    const fresh = await swapFindings(db, c.ws, { kind, shiftId: String(req.shift_id), fromStaffId: from, toStaffId: to });
    // Auto path: re-check right now. A person who approved may accept the findings; the policy never does.
    if (item.decided_path === "auto" && fresh.reasons.length) throw new Error(`Không còn trong quy tắc: ${fresh.reasons.join(" ")}`);
    if (!fresh.shift) throw new Error("Không tìm thấy ca.");
    const upd = await db.from("shifts_shifts").update({ staff_id: to, status: "swapped", source: "swap" }).eq("id", String(req.shift_id)).eq("workspace_id", c.ws);
    if (upd.error) throw new Error(upd.error.message);
    await db.from("shifts_swap_requests").update({ status: "approved", decided_by: by.name, decided_at: new Date().toISOString(), checks: fresh.reasons, work_item_id: item.id }).eq("id", swapId);
    const setup = await loadSetup(db, c.ws, { withPay: false });
    const line = shiftLine(setup, fresh.shift);
    const toP = staffOf(setup, to);
    const fromP = staffOf(setup, from);
    if (toP) await notifyStaff({ ...c, db }, toP, "swap", `Bạn đã nhận ca: ${line}${fromP ? ` (thay ${fromP.name})` : ""}.`, { shiftId: fresh.shift.id, workItemId: item.id });
    if (fromP) await notifyStaff({ ...c, db }, fromP, "swap", `Yêu cầu đổi ca ${line} đã được duyệt: ${toP?.name ?? "người khác"} sẽ làm ca này.`, { shiftId: fresh.shift.id, workItemId: item.id });
    await logEvidence(db, c.ws, { work_item_id: item.id, kind: "shifts.swap_approved", actor: by.name, summary: `Duyệt ${kind === "claim" ? "nhận ca trống" : "đổi ca"}: ${line} → ${toP?.name ?? "—"}`, evidence: fresh.reasons.join(" ") || "Trong quy tắc" });
    return { summary: `Đã duyệt ${kind === "claim" ? "nhận ca trống" : "đổi ca"}: ${line} giờ do ${toP?.name ?? "—"} làm.`, evidence: "captured", href: "/m/shifts/workbench" };
  },
  onReject: async (c, _item, p, by) => {
    const db = supabaseAdmin();
    const { data } = await db.from("shifts_swap_requests").select("*").eq("id", f(p, "swap_id")).eq("workspace_id", c.ws).maybeSingle();
    const req = data as R | null;
    if (!req || req.status !== "pending") return;
    await db.from("shifts_swap_requests").update({ status: "declined", decided_by: by.name, decided_at: new Date().toISOString() }).eq("id", String(req.id));
    const setup = await loadSetup(db, c.ws, { withPay: false });
    const who = staffOf(setup, ((req.from_staff_id as string | null) ?? String(req.to_staff_id)));
    if (who) await notifyStaff({ ...c, db }, who, "swap", "Yêu cầu đổi ca của bạn chưa được duyệt. Bạn giữ nguyên ca cũ.", { workItemId: _item.id });
  },
};

/* ------------------------------------------------------------------ approve_leave */

const approveLeave: Performer = {
  prepare: pass,
  perform: async (c, item, p, by) => {
    const db = supabaseAdmin();
    const leaveId = f(p, "leave_id");
    const { data } = await db.from("shifts_leave_requests").select("*").eq("id", leaveId).eq("workspace_id", c.ws).maybeSingle();
    const req = data as R | null;
    if (!req) throw new Error("Không tìm thấy đơn xin nghỉ.");
    if (req.status === "approved") return { summary: "Đơn xin nghỉ này đã được duyệt trước đó.", evidence: "captured" };
    if (req.status !== "pending") throw new Error("Đơn này đã được xử lý.");
    const staffId = String(req.staff_id);
    const from = String(req.from_date);
    const to = String(req.to_date);
    await db.from("shifts_leave_requests").update({ status: "approved", decided_by: by.name, decided_at: new Date().toISOString(), work_item_id: item.id }).eq("id", leaveId);
    const setup = await loadSetup(db, c.ws, { withPay: false });
    const person = staffOf(setup, staffId);
    // Their shifts in the range become open shifts so someone else can take them.
    const hit = await affectedShifts(db, c.ws, staffId, from, to);
    if (hit.length) await db.from("shifts_shifts").update({ staff_id: null, source: "manual", note: `${person?.name ?? "Người nghỉ"} xin nghỉ` }).in("id", hit.map((s) => s.id));
    if (person) await notifyStaff({ ...c, db }, person, "leave", `Đơn xin nghỉ ${from === to ? dayLabel(from) : `${dayLabel(from)} – ${dayLabel(to)}`} đã được duyệt.`, { workItemId: item.id });
    if (hit.length) {
      const parts: Array<string> = [];
      for (const s of hit.slice(0, 6)) {
        const cands = (await coverCandidates(db, c.ws, s, [staffId])).slice(0, 3).map((x) => x.name);
        parts.push(`${shiftLine(setup, s)}${cands.length ? ` (có thể hỏi: ${cands.join(", ")})` : " (chưa có ai rảnh)"}`);
      }
      await notifyManagers({ ...c, db }, "gap", `${person?.name ?? "Một nhân viên"} nghỉ nên có ${hit.length} ca thành ca trống: ${parts.join("; ")}.`, { workItemId: item.id });
    }
    await logEvidence(db, c.ws, { work_item_id: item.id, kind: "shifts.leave_approved", actor: by.name, summary: `Duyệt nghỉ cho ${person?.name ?? "—"} (${from}${from === to ? "" : ` → ${to}`}), ${hit.length} ca thành ca trống`, evidence: leaveId });
    return { summary: `Đã duyệt nghỉ cho ${person?.name ?? "—"}; ${hit.length} ca trở thành ca trống.`, evidence: "captured", href: "/m/shifts/workbench" };
  },
  onReject: async (c, item, p, by) => {
    const db = supabaseAdmin();
    const { data } = await db.from("shifts_leave_requests").select("*").eq("id", f(p, "leave_id")).eq("workspace_id", c.ws).maybeSingle();
    const req = data as R | null;
    if (!req || req.status !== "pending") return;
    await db.from("shifts_leave_requests").update({ status: "declined", decided_by: by.name, decided_at: new Date().toISOString() }).eq("id", String(req.id));
    const setup = await loadSetup(db, c.ws, { withPay: false });
    const person = staffOf(setup, String(req.staff_id));
    if (person) await notifyStaff({ ...c, db }, person, "leave", `Đơn xin nghỉ ${dayLabel(String(req.from_date))} chưa được duyệt, bạn giữ nguyên lịch.`, { workItemId: item.id });
  },
};

/* ------------------------------------------------------------------ remind_shift */

const remindShift: Performer = {
  prepare: pass,
  perform: async (c, item, p) => {
    const db = supabaseAdmin();
    const { data } = await db.from("shifts_shifts").select("*").eq("id", f(p, "shift_id")).eq("workspace_id", c.ws).maybeSingle();
    const row = data as R | null;
    if (!row || !["published", "swapped"].includes(String(row.status)) || !row.staff_id) return { summary: "Ca này không còn hiệu lực nên không nhắc.", evidence: "pending" };
    const sh = asShift(row);
    const setup = await loadSetup(db, c.ws, { withPay: false });
    const person = staffOf(setup, sh.staffId);
    if (!person) return { summary: "Người làm ca này không còn trong danh sách.", evidence: "pending" };
    const mates = (((await db.from("shifts_shifts").select("staff_id").eq("workspace_id", c.ws).eq("shift_date", sh.date).in("status", ["published", "swapped"]).not("staff_id", "is", null).neq("staff_id", person.id)).data ?? []) as Array<{ staff_id: string }>).map((x) => nameOf(setup, x.staff_id));
    const shop = ((await db.from("workspaces").select("name").eq("id", c.ws).maybeSingle()).data as { name?: string } | null)?.name ?? "cửa hàng";
    const body = `Nhắc ca: ${positionOf(setup, sh.positionId)?.name ?? "ca làm"} hôm nay ${sh.start}–${sh.end} tại ${shop}.${mates.length ? ` Cùng ngày: ${[...new Set(mates)].slice(0, 5).join(", ")}.` : ""} Nhớ bấm "Vào ca" khi đến.`;
    const r = await notifyStaff({ ...c, db }, person, "reminder", body, { shiftId: sh.id, workItemId: item.id });
    return { summary: `Đã nhắc ${person.name} ca ${sh.start}–${sh.end}${r.telegram ? " (Office và Telegram)" : r.zalo ? " (Office và Zalo)" : " trong Office"}.`, evidence: "captured" };
  },
};

export const SHIFTS_PERFORMERS = { publish_schedule: publishSchedule, approve_swap: approveSwap, approve_leave: approveLeave, remind_shift: remindShift } as const;
