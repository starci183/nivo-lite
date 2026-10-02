"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "@/i18n/server";
import { resumeWork, type EngineCtx } from "@/lib/engine";
import { engineCtx } from "@/lib/flow-ctx";
import { deciderOf, requireManager } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import type { Outcome } from "@/lib/types";
import {
  addDraftShift, explainSchedule, proposeWeek, reassignShift, removeDraftShift, requestLeaveWork, requestPublish, requestSwapWork,
  type Proposed,
} from "@/lib/module-shifts-core";
import { loadBench, loadMine, type BenchData, type MineData } from "@/lib/module-shifts-view";
import { dayLabel, loadSetup, shiftLine, toShift } from "@/lib/module-shifts-data";
import { parseImport, POSITION_COLORS, fold } from "@/lib/module-shifts-import";
import { notifyManagers } from "@/lib/module-shifts-notify";
import { affectedShifts, coverCandidates } from "@/lib/module-shifts-rules";
import { instantOf, toMin, todayVn } from "@/lib/module-shifts-types";

type R = Record<string, unknown>;
const run = async <T>(fn: () => Promise<T>): Promise<Outcome<T>> => {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};
const refresh = () => revalidatePath("/m/shifts", "layout");

/** Reload for the client after any change (and for week navigation): the whole manager bench for one week. */
export async function loadBenchAction(monday: string): Promise<Outcome<BenchData>> {
  return run(async () => {
    const s = await getSession();
    const db = await supabaseServer();
    return loadBench(db, s.workspace.id, s.member.role, s.userId, monday);
  });
}

/** The signed-in person's own schedule, requests and open shifts. */
export async function loadMineAction(): Promise<Outcome<MineData>> {
  return run(async () => {
    const s = await getSession();
    const db = await supabaseServer();
    const setup = await loadSetup(db, s.workspace.id, { withPay: false });
    const profile = (await db.rpc("shifts_my_profile", { ws: s.workspace.id })).data as string | null;
    return loadMine(db, s.workspace.id, setup, profile);
  });
}

/** Context of a signed-in staff member acting on their own request: the gate and the schedule writes run with the service role (the member's own rows are checked here). */
const staffCtx = async (): Promise<{ c: EngineCtx; profileId: string; name: string }> => {
  const session = await getSession();
  const db = await supabaseServer();
  const { data } = await db.rpc("shifts_my_profile", { ws: session.workspace.id });
  if (!data) throw new Error("Tài khoản của bạn chưa được gắn với một nhân viên trong lịch ca. Nhờ chủ cửa hàng liên kết giúp.");
  return { c: { db: supabaseAdmin(), ws: session.workspace.id, actor: session.userName, locale: await getLocale() }, profileId: String(data), name: session.userName };
};

const pipelineOn = async (ws: string, key: string): Promise<boolean> =>
  Boolean(((await supabaseAdmin().from("automation_pipelines").select("enabled").eq("workspace_id", ws).eq("template_key", key).maybeSingle()).data as { enabled?: boolean } | null)?.enabled);

/* ------------------------------------------------------------------ the week: propose, explain, edit, publish */

export async function proposeWeekAction(week: string): Promise<Outcome<Proposed>> {
  return run(async () => {
    const m = await requireManager();
    const c = await engineCtx();
    const out = await proposeWeek(c, week, m.displayName);
    refresh();
    return out;
  });
}

export async function explainScheduleAction(scheduleId: string): Promise<Outcome<{ source: "openclaw" | "fallback"; text: string; ms: number }>> {
  return run(async () => {
    await requireManager();
    const out = await explainSchedule(await engineCtx(), scheduleId);
    refresh();
    return out;
  });
}

export async function reassignShiftAction(shiftId: string, staffId: string | null): Promise<Outcome<{ warnings: Array<string> }>> {
  return run(async () => {
    await requireManager();
    const warnings = await reassignShift(await engineCtx(), shiftId, staffId);
    refresh();
    return { warnings };
  });
}

export async function addShiftAction(scheduleId: string, s: { date: string; start: string; end: string; positionId: string; staffId: string | null }): Promise<Outcome<{ id: string }>> {
  return run(async () => {
    await requireManager();
    const id = await addDraftShift(await engineCtx(), scheduleId, s);
    refresh();
    return { id };
  });
}

export async function removeShiftAction(shiftId: string): Promise<Outcome<null>> {
  return run(async () => {
    await requireManager();
    await removeDraftShift(await engineCtx(), shiftId);
    refresh();
    return null;
  });
}

/** "Đăng lịch": goes through the gate. With the rule on "ask" the item waits for the owner (in the gate or right here). */
export async function publishScheduleAction(scheduleId: string): Promise<Outcome<{ status: string; workItemId: string; summary: string }>> {
  return run(async () => {
    await requireManager();
    const item = await requestPublish(await engineCtx(), scheduleId);
    refresh();
    return { status: item.status, workItemId: item.id, summary: item.result?.summary ?? item.proposal.summary };
  });
}

/** The owner approves or declines a waiting item of this module from the workbench: the same resume path as the gate in Office. */
export async function decideWorkAction(workItemId: string, decision: "approved" | "rejected"): Promise<Outcome<{ status: string; summary: string }>> {
  return run(async () => {
    const m = await requireManager();
    const c = await engineCtx();
    const item = await resumeWork(c, workItemId, decision, {}, deciderOf(m));
    refresh();
    return { status: item.status, summary: item.result?.summary ?? item.proposal.summary };
  });
}

/* ------------------------------------------------------------------ setup (manager) */

export async function savePositionAction(p: { id?: string; name: string; color?: string }): Promise<Outcome<null>> {
  return run(async () => {
    await requireManager();
    const c = await engineCtx();
    const name = p.name.trim();
    if (!name) throw new Error("Cần tên vị trí.");
    const res = p.id
      ? await c.db.from("shifts_positions").update({ name, ...(p.color ? { color: p.color } : {}) }).eq("id", p.id).eq("workspace_id", c.ws)
      : await c.db.from("shifts_positions").insert({ workspace_id: c.ws, name, color: p.color ?? POSITION_COLORS[Math.floor(Math.random() * POSITION_COLORS.length)] });
    if (res.error) throw new Error(res.error.code === "23505" ? "Vị trí này đã có." : res.error.message);
    refresh();
    return null;
  });
}

export async function removePositionAction(id: string): Promise<Outcome<null>> {
  return run(async () => {
    await requireManager();
    const c = await engineCtx();
    const res = await c.db.from("shifts_positions").update({ active: false }).eq("id", id).eq("workspace_id", c.ws);
    if (res.error) throw new Error(res.error.message);
    refresh();
    return null;
  });
}

export type StaffInput = { id?: string; name: string; positionIds: Array<string>; wage: number; maxWeek: number; maxDay: number; minRest: number; staffRowId?: string | null; phone?: string; telegramChatId?: string; zaloUserId?: string; active?: boolean };

export async function saveStaffAction(s: StaffInput): Promise<Outcome<{ id: string }>> {
  return run(async () => {
    await requireManager();
    const c = await engineCtx();
    const name = s.name.trim();
    if (!name) throw new Error("Cần tên nhân viên.");
    const row = {
      workspace_id: c.ws, name, position_ids: s.positionIds, max_hours_week: s.maxWeek, max_hours_day: s.maxDay, min_rest_hours: s.minRest, staff_id: s.staffRowId ?? null,
      phone: s.phone?.trim() || null, telegram_chat_id: s.telegramChatId?.trim() || null, zalo_user_id: s.zaloUserId?.trim() || null, active: s.active !== false,
    };
    const res = s.id ? await c.db.from("shifts_staff").update(row).eq("id", s.id).eq("workspace_id", c.ws).select("id").single() : await c.db.from("shifts_staff").insert(row).select("id").single();
    if (res.error) throw new Error(res.error.message);
    const id = (res.data as { id: string }).id;
    const pay = await c.db.from("shifts_staff_pay").upsert({ staff_id: id, workspace_id: c.ws, hourly_wage_vnd: Math.max(0, Math.round(s.wage)), updated_at: new Date().toISOString() }, { onConflict: "staff_id" });
    if (pay.error) throw new Error(pay.error.message);
    refresh();
    return { id };
  });
}

export type BlockInput = { id?: string; weekdays: Array<number>; start: string; end: string; positionId: string; min: number; ideal: number; peak: boolean };

export async function saveCoverageAction(b: BlockInput): Promise<Outcome<null>> {
  return run(async () => {
    await requireManager();
    const c = await engineCtx();
    if (toMin(b.end) <= toMin(b.start)) throw new Error("Giờ kết thúc phải sau giờ bắt đầu.");
    if (b.ideal < b.min) throw new Error("Số người lý tưởng không được ít hơn tối thiểu.");
    if (!b.weekdays.length) throw new Error("Chọn ít nhất một ngày.");
    const rows = b.weekdays.map((d) => ({ workspace_id: c.ws, weekday: d, start_time: b.start, end_time: b.end, position_id: b.positionId, min_staff: b.min, ideal_staff: b.ideal, is_peak: b.peak }));
    const res = b.id ? await c.db.from("shifts_coverage").update(rows[0]).eq("id", b.id).eq("workspace_id", c.ws) : await c.db.from("shifts_coverage").insert(rows);
    if (res.error) throw new Error(res.error.message);
    refresh();
    return null;
  });
}

export async function removeCoverageAction(id: string): Promise<Outcome<null>> {
  return run(async () => {
    await requireManager();
    const c = await engineCtx();
    await c.db.from("shifts_coverage").delete().eq("id", id).eq("workspace_id", c.ws);
    refresh();
    return null;
  });
}

export async function saveSettingsAction(s: { swapNoticeHours: number; leaveNoticeDays: number; remindMinutes: number; noshowMinutes: number; overtimeHoursWeek: number; openingHours: Record<string, { open: string; close: string } | null> }): Promise<Outcome<null>> {
  return run(async () => {
    await requireManager();
    const c = await engineCtx();
    const res = await c.db.from("shifts_settings").upsert({
      workspace_id: c.ws, swap_notice_hours: s.swapNoticeHours, leave_notice_days: s.leaveNoticeDays, remind_minutes: s.remindMinutes, noshow_minutes: s.noshowMinutes,
      overtime_hours_week: s.overtimeHoursWeek, opening_hours: s.openingHours, updated_at: new Date().toISOString(),
    }, { onConflict: "workspace_id" });
    if (res.error) throw new Error(res.error.message);
    refresh();
    return null;
  });
}

/** A recurring window or a date exception for one person, entered by a manager (approved at once). */
export async function addAvailabilityAction(a: { staffId: string; weekday: number | null; date: string | null; start: string; end: string; available: boolean; note?: string }): Promise<Outcome<null>> {
  return run(async () => {
    const m = await requireManager();
    const c = await engineCtx();
    const res = await c.db.from("shifts_availability").insert({
      workspace_id: c.ws, staff_id: a.staffId, weekday: a.date ? null : a.weekday, shift_date: a.date, start_time: a.start, end_time: a.end, available: a.available, note: a.note ?? "", status: "approved", decided_by: m.displayName,
    });
    if (res.error) throw new Error(res.error.message);
    refresh();
    return null;
  });
}

export async function removeAvailabilityAction(id: string): Promise<Outcome<null>> {
  return run(async () => {
    await requireManager();
    const c = await engineCtx();
    await c.db.from("shifts_availability").delete().eq("id", id).eq("workspace_id", c.ws);
    refresh();
    return null;
  });
}

export async function decideAvailabilityAction(id: string, decision: "approved" | "declined"): Promise<Outcome<null>> {
  return run(async () => {
    const m = await requireManager();
    const c = await engineCtx();
    const res = await c.db.from("shifts_availability").update({ status: decision, decided_by: m.displayName }).eq("id", id).eq("workspace_id", c.ws).eq("status", "pending");
    if (res.error) throw new Error(res.error.message);
    refresh();
    return null;
  });
}

/** "Nhập nhanh": creates the positions, staff and coverage blocks of the text in one go. Nothing is created when any line is wrong. */
export async function importQuickAction(input: { positions: string; staff: string; coverage: string }): Promise<Outcome<{ positions: number; staff: number; blocks: number }>> {
  return run(async () => {
    await requireManager();
    const c = await engineCtx();
    const setup = await loadSetup(c.db, c.ws);
    const parsed = parseImport(input, setup.positions.map((p) => p.name));
    if (parsed.errors.length) throw new Error(parsed.errors.join(" "));
    if (!parsed.positions.length && !parsed.staff.length && !parsed.blocks.length) throw new Error("Chưa có gì để tạo.");
    const idByName = new Map(setup.positions.map((p) => [fold(p.name), p.id]));
    const fresh = parsed.positions.filter((n) => !idByName.has(fold(n)));
    if (fresh.length) {
      const ins = await c.db.from("shifts_positions").insert(fresh.map((name, i) => ({ workspace_id: c.ws, name, color: POSITION_COLORS[(setup.positions.length + i) % POSITION_COLORS.length], sort_order: setup.positions.length + i }))).select("id, name");
      if (ins.error) throw new Error(ins.error.message);
      for (const p of (ins.data ?? []) as Array<{ id: string; name: string }>) idByName.set(fold(p.name), p.id);
    }
    const knownStaff = new Set(setup.staff.map((s) => fold(s.name)));
    let staffN = 0;
    for (const s of parsed.staff) {
      if (knownStaff.has(fold(s.name))) continue;
      const ins = await c.db.from("shifts_staff").insert({ workspace_id: c.ws, name: s.name, position_ids: s.positions.map((p) => idByName.get(fold(p))).filter(Boolean), ...(s.maxWeek ? { max_hours_week: s.maxWeek } : {}) }).select("id").single();
      if (ins.error) throw new Error(ins.error.message);
      await c.db.from("shifts_staff_pay").upsert({ staff_id: (ins.data as { id: string }).id, workspace_id: c.ws, hourly_wage_vnd: s.wage }, { onConflict: "staff_id" });
      staffN++;
    }
    if (parsed.blocks.length) {
      const ins = await c.db.from("shifts_coverage").insert(parsed.blocks.map((b) => ({ workspace_id: c.ws, weekday: b.weekday, start_time: b.start, end_time: b.end, position_id: idByName.get(fold(b.position)), min_staff: b.min, ideal_staff: b.ideal, is_peak: b.peak })));
      if (ins.error) throw new Error(ins.error.message);
    }
    refresh();
    return { positions: fresh.length, staff: staffN, blocks: parsed.blocks.length };
  });
}

/* ------------------------------------------------------------------ staff: their own requests and check-in */

export async function submitLeaveAction(input: { from: string; to: string; reason: string }): Promise<Outcome<{ status: string; summary: string }>> {
  return run(async () => {
    const { c, profileId, name } = await staffCtx();
    const from = input.from;
    const to = input.to || input.from;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) throw new Error("Chọn ngày nghỉ hợp lệ (ngày kết thúc không trước ngày bắt đầu).");
    if (to < todayVn()) throw new Error("Không xin nghỉ cho ngày đã qua.");
    const db = await supabaseServer();
    const ins = await db.from("shifts_leave_requests").insert({ workspace_id: c.ws, staff_id: profileId, from_date: from, to_date: to, reason: input.reason.trim().slice(0, 300), status: "pending" }).select("id").single();
    if (ins.error) throw new Error(ins.error.message);
    const id = (ins.data as { id: string }).id;
    const item = await requestLeaveWork(c, id);
    if (await pipelineOn(c.ws, "shifts_leave_gap")) {
      const setup = await loadSetup(c.db, c.ws, { withPay: false });
      const hit = await affectedShifts(c.db, c.ws, profileId, from, to);
      const parts: Array<string> = [];
      for (const s of hit.slice(0, 6)) {
        const who = (await coverCandidates(c.db, c.ws, s, [profileId])).slice(0, 3).map((x) => x.name);
        parts.push(`${shiftLine(setup, s)}${who.length ? ` (có thể hỏi: ${who.join(", ")})` : " (chưa có ai rảnh)"}`);
      }
      await notifyManagers(c, "gap", hit.length
        ? `${name} xin nghỉ ${from === to ? dayLabel(from) : `${dayLabel(from)} – ${dayLabel(to)}`}: sẽ thiếu người ở ${hit.length} ca: ${parts.join("; ")}.`
        : `${name} xin nghỉ ${dayLabel(from)}: không có ca nào bị ảnh hưởng.`, { workItemId: item.id });
    }
    refresh();
    return { status: item.status, summary: "Đơn xin nghỉ đã gửi, đang chờ chủ duyệt." };
  });
}

export async function submitSwapAction(input: { shiftId: string; toStaffId: string; reason: string }): Promise<Outcome<{ status: string; summary: string }>> {
  return run(async () => {
    const { c, profileId } = await staffCtx();
    const db = await supabaseServer();
    const { data } = await db.from("shifts_shifts").select("*").eq("id", input.shiftId).maybeSingle();
    const sh = data as R | null;
    if (!sh || sh.staff_id !== profileId) throw new Error("Bạn chỉ xin đổi được ca của chính mình.");
    if (input.toStaffId === profileId) throw new Error("Chọn một đồng nghiệp khác để đổi ca.");
    const ins = await db.from("shifts_swap_requests").insert({ workspace_id: c.ws, kind: "swap", shift_id: input.shiftId, from_staff_id: profileId, to_staff_id: input.toStaffId, reason: input.reason.trim().slice(0, 300), status: "pending" }).select("id").single();
    if (ins.error) throw new Error(ins.error.message);
    const item = await requestSwapWork(c, (ins.data as { id: string }).id, { kind: "swap", shiftId: input.shiftId, fromStaffId: profileId, toStaffId: input.toStaffId });
    refresh();
    return { status: item.status, summary: item.status === "done" ? (item.result?.summary ?? "Đã đổi ca.") : "Yêu cầu đổi ca đang chờ chủ duyệt." };
  });
}

/** "Đăng ký ca trống": the same rules as a swap; inside them the shift is yours at once, otherwise it waits for the owner. */
export async function claimShiftAction(shiftId: string): Promise<Outcome<{ status: string; summary: string }>> {
  return run(async () => {
    const { c, profileId } = await staffCtx();
    const db = await supabaseServer();
    const { data } = await db.from("shifts_shifts").select("*").eq("id", shiftId).maybeSingle();
    const sh = data as R | null;
    if (!sh || sh.staff_id) throw new Error("Ca này đã có người nhận.");
    const ins = await db.from("shifts_swap_requests").insert({ workspace_id: c.ws, kind: "claim", shift_id: shiftId, from_staff_id: null, to_staff_id: profileId, status: "pending" }).select("id").single();
    if (ins.error) throw new Error(ins.error.message);
    const item = await requestSwapWork(c, (ins.data as { id: string }).id, { kind: "claim", shiftId, fromStaffId: null, toStaffId: profileId });
    refresh();
    return { status: item.status, summary: item.status === "done" ? (item.result?.summary ?? "Bạn đã nhận ca.") : "Đăng ký của bạn đang chờ chủ duyệt." };
  });
}

export async function submitAvailabilityAction(a: { weekday: number | null; date: string | null; start: string; end: string; available: boolean; note: string }): Promise<Outcome<null>> {
  return run(async () => {
    const { c, profileId } = await staffCtx();
    if (toMin(a.end) <= toMin(a.start)) throw new Error("Giờ kết thúc phải sau giờ bắt đầu.");
    if (a.date === null && a.weekday === null) throw new Error("Chọn thứ trong tuần hoặc một ngày cụ thể.");
    const db = await supabaseServer();
    const res = await db.from("shifts_availability").insert({ workspace_id: c.ws, staff_id: profileId, weekday: a.date ? null : a.weekday, shift_date: a.date, start_time: a.start, end_time: a.end, available: a.available, note: a.note.trim().slice(0, 200), status: "pending" });
    if (res.error) throw new Error(res.error.message);
    refresh();
    return null;
  });
}

/** "Vào ca": only your own shift, today, from 30 minutes before the start to the end. */
export async function checkInAction(shiftId: string): Promise<Outcome<{ at: string }>> {
  return run(async () => {
    const { c, profileId } = await staffCtx();
    const db = await supabaseServer();
    const { data } = await db.from("shifts_shifts").select("*").eq("id", shiftId).maybeSingle();
    if (!data) throw new Error("Không tìm thấy ca.");
    const sh = toShift(data as R);
    if (sh.staffId !== profileId) throw new Error("Đây không phải ca của bạn.");
    const now = new Date();
    const start = instantOf(sh.date, toMin(sh.start)).getTime();
    const end = instantOf(sh.date, toMin(sh.end)).getTime();
    if (now.getTime() < start - 30 * 60_000) throw new Error("Chưa đến giờ vào ca (bấm được từ 30 phút trước giờ bắt đầu).");
    if (now.getTime() > end) throw new Error("Ca này đã kết thúc.");
    const res = await db.from("shifts_attendance").insert({ workspace_id: c.ws, shift_id: shiftId, staff_id: profileId });
    if (res.error && res.error.code !== "23505") throw new Error(res.error.message);
    refresh();
    return { at: now.toISOString() };
  });
}

