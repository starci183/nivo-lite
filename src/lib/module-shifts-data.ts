import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addDays, segOf, toMin, hhmm, weekDates,
  type Avail, type Block, type Env, type Leave, type Seg, type Shift, type ShiftPosition, type ShiftStaff,
} from "./module-shifts-types";

type Db = SupabaseClient;

/** Rules and hours of the shop (one row per workspace; defaults when the owner has not set them). */
export type ShiftsSettings = {
  readonly openingHours: Readonly<Record<string, { open: string; close: string } | null>>;
  readonly swapNoticeHours: number;
  readonly leaveNoticeDays: number;
  readonly remindMinutes: number;
  readonly noshowMinutes: number;
  readonly overtimeHoursWeek: number;
};
export const DEFAULT_SETTINGS: ShiftsSettings = { openingHours: {}, swapNoticeHours: 24, leaveNoticeDays: 2, remindMinutes: 60, noshowMinutes: 10, overtimeHoursWeek: 48 };

export type ScheduleRow = {
  readonly id: string; readonly weekStart: string; readonly version: number; readonly status: "draft" | "published" | "superseded";
  readonly source: "solver" | "manual"; readonly costVnd: number; readonly explanation: string; readonly solverMs: number | null;
  readonly summary: Record<string, unknown>; readonly evidence: Record<string, unknown>; readonly workItemId: string | null;
  readonly createdAt: string; readonly publishedAt: string | null;
};
export type LeaveRow = { readonly id: string; readonly staffId: string; readonly from: string; readonly to: string; readonly reason: string; readonly status: "pending" | "approved" | "declined"; readonly workItemId: string | null; readonly createdAt: string };
export type SwapRow = {
  readonly id: string; readonly kind: "swap" | "claim"; readonly shiftId: string; readonly fromStaffId: string | null; readonly toStaffId: string; readonly reason: string;
  readonly status: "pending" | "approved" | "declined"; readonly checks: ReadonlyArray<string>; readonly workItemId: string | null; readonly createdAt: string;
};
export type AvailRow = Avail & { readonly id: string; readonly note: string; readonly status: "pending" | "approved" | "declined"; readonly createdAt: string };

export type Setup = {
  readonly positions: ReadonlyArray<ShiftPosition>;
  readonly staff: ReadonlyArray<ShiftStaff>;
  readonly blocks: ReadonlyArray<Block>;
  readonly settings: ShiftsSettings;
};

type R = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
const n = (v: unknown, d = 0) => (typeof v === "number" ? v : Number(v) || d);

export const loadSetup = async (db: Db, ws: string, opts: { withPay?: boolean } = {}): Promise<Setup> => {
  const [pos, st, pay, cov, set] = await Promise.all([
    db.from("shifts_positions").select("*").eq("workspace_id", ws).eq("active", true).order("sort_order").order("created_at"),
    db.from("shifts_staff").select("*").eq("workspace_id", ws).order("created_at"),
    opts.withPay === false ? Promise.resolve({ data: [] as Array<R> }) : db.from("shifts_staff_pay").select("staff_id, hourly_wage_vnd").eq("workspace_id", ws),
    db.from("shifts_coverage").select("*").eq("workspace_id", ws).order("weekday").order("start_time"),
    db.from("shifts_settings").select("*").eq("workspace_id", ws).maybeSingle(),
  ]);
  const wage = new Map(((pay.data ?? []) as Array<R>).map((p) => [s(p.staff_id), n(p.hourly_wage_vnd)]));
  const row = set.data as R | null;
  return {
    positions: ((pos.data ?? []) as Array<R>).map((p) => ({ id: s(p.id), name: s(p.name), color: s(p.color) || "#2f6fed" })),
    staff: ((st.data ?? []) as Array<R>).map((p) => ({
      id: s(p.id), name: s(p.name), positionIds: (p.position_ids as Array<string>) ?? [], skills: (p.skills as Array<string>) ?? [], wage: wage.get(s(p.id)) ?? 0,
      maxWeek: n(p.max_hours_week, 48), maxDay: n(p.max_hours_day, 10), minRest: n(p.min_rest_hours, 10), staffRowId: (p.staff_id as string | null) ?? null,
      telegramChatId: (p.telegram_chat_id as string | null) ?? null, zaloUserId: (p.zalo_user_id as string | null) ?? null, phone: (p.phone as string | null) ?? null,
      active: p.active !== false,
    })),
    blocks: ((cov.data ?? []) as Array<R>).map((c) => ({
      id: s(c.id), weekday: n(c.weekday), start: hhmm(s(c.start_time)), end: hhmm(s(c.end_time)), positionId: s(c.position_id), min: n(c.min_staff), ideal: n(c.ideal_staff), peak: c.is_peak === true,
    })),
    settings: row ? {
      openingHours: (row.opening_hours as ShiftsSettings["openingHours"]) ?? {}, swapNoticeHours: n(row.swap_notice_hours, 24), leaveNoticeDays: n(row.leave_notice_days, 2),
      remindMinutes: n(row.remind_minutes, 60), noshowMinutes: n(row.noshow_minutes, 10), overtimeHoursWeek: n(row.overtime_hours_week, 48),
    } : DEFAULT_SETTINGS,
  };
};

const toSchedule = (r: R): ScheduleRow => ({
  id: s(r.id), weekStart: s(r.week_start), version: n(r.version, 1), status: r.status as ScheduleRow["status"], source: r.source as ScheduleRow["source"], costVnd: n(r.cost_vnd),
  explanation: s(r.explanation), solverMs: r.solver_ms === null || r.solver_ms === undefined ? null : n(r.solver_ms), summary: (r.summary as R) ?? {}, evidence: (r.evidence as R) ?? {},
  workItemId: (r.work_item_id as string | null) ?? null, createdAt: s(r.created_at), publishedAt: (r.published_at as string | null) ?? null,
});
export const toShift = (r: R): Shift => ({ id: s(r.id), date: s(r.shift_date), start: hhmm(s(r.start_time)), end: hhmm(s(r.end_time)), positionId: s(r.position_id), staffId: (r.staff_id as string | null) ?? null, status: s(r.status) });

/** Every version of the week, newest first. */
export const loadSchedules = async (db: Db, ws: string, monday: string): Promise<Array<ScheduleRow>> =>
  (((await db.from("shifts_schedules").select("*").eq("workspace_id", ws).eq("week_start", monday).order("version", { ascending: false })).data ?? []) as Array<R>).map(toSchedule);

/** The version people work with: the open draft when there is one, else the published week. */
export const currentSchedule = (list: ReadonlyArray<ScheduleRow>): ScheduleRow | null =>
  list.find((x) => x.status === "draft") ?? list.find((x) => x.status === "published") ?? null;

export const loadShifts = async (db: Db, ws: string, scheduleId: string): Promise<Array<Shift>> =>
  (((await db.from("shifts_shifts").select("*").eq("workspace_id", ws).eq("schedule_id", scheduleId).neq("status", "cancelled").order("shift_date").order("start_time")).data ?? []) as Array<R>).map(toShift);

export const loadLeaves = async (db: Db, ws: string, filter: { status?: LeaveRow["status"]; from?: string; to?: string; staffId?: string } = {}): Promise<Array<LeaveRow>> => {
  let q = db.from("shifts_leave_requests").select("*").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(200);
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.staffId) q = q.eq("staff_id", filter.staffId);
  if (filter.from) q = q.gte("to_date", filter.from);
  if (filter.to) q = q.lte("from_date", filter.to);
  return ((await q).data as Array<R> | null ?? []).map((r) => ({
    id: s(r.id), staffId: s(r.staff_id), from: s(r.from_date), to: s(r.to_date), reason: s(r.reason), status: r.status as LeaveRow["status"], workItemId: (r.work_item_id as string | null) ?? null, createdAt: s(r.created_at),
  }));
};

export const loadSwaps = async (db: Db, ws: string, filter: { status?: SwapRow["status"] } = {}): Promise<Array<SwapRow>> => {
  let q = db.from("shifts_swap_requests").select("*").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(200);
  if (filter.status) q = q.eq("status", filter.status);
  return ((await q).data as Array<R> | null ?? []).map((r) => ({
    id: s(r.id), kind: r.kind as SwapRow["kind"], shiftId: s(r.shift_id), fromStaffId: (r.from_staff_id as string | null) ?? null, toStaffId: s(r.to_staff_id), reason: s(r.reason),
    status: r.status as SwapRow["status"], checks: (r.checks as Array<string>) ?? [], workItemId: (r.work_item_id as string | null) ?? null, createdAt: s(r.created_at),
  }));
};

export const loadAvailability = async (db: Db, ws: string, filter: { status?: AvailRow["status"]; staffId?: string } = {}): Promise<Array<AvailRow>> => {
  let q = db.from("shifts_availability").select("*").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(500);
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.staffId) q = q.eq("staff_id", filter.staffId);
  return ((await q).data as Array<R> | null ?? []).map((r) => ({
    id: s(r.id), staffId: s(r.staff_id), weekday: r.weekday === null || r.weekday === undefined ? null : n(r.weekday), date: (r.shift_date as string | null) ?? null,
    start: hhmm(s(r.start_time)), end: hhmm(s(r.end_time)), available: r.available !== false, note: s(r.note), status: r.status as AvailRow["status"], createdAt: s(r.created_at),
  }));
};

/** The environment the rules run in: approved availability and approved leave, plus the work of the day before the week (rest across the boundary). */
export const loadEnv = async (db: Db, ws: string, monday: string, setup: Setup): Promise<Env> => {
  const sunday = addDays(monday, 6);
  const [avail, leaves, prev] = await Promise.all([
    loadAvailability(db, ws, { status: "approved" }),
    loadLeaves(db, ws, { status: "approved", from: monday, to: sunday }),
    db.from("shifts_shifts").select("*").eq("workspace_id", ws).eq("shift_date", addDays(monday, -1)).in("status", ["published", "swapped"]).not("staff_id", "is", null),
  ]);
  const prior = new Map<string, Array<Seg>>();
  for (const r of (prev.data ?? []) as Array<R>) {
    const sh = toShift(r);
    if (sh.staffId) prior.set(sh.staffId, [...(prior.get(sh.staffId) ?? []), segOf(sh)]);
  }
  return { staff: new Map(setup.staff.map((p) => [p.id, p])), avail, leaves: leaves.map((l): Leave => ({ staffId: l.staffId, from: l.from, to: l.to })), prior, overtimeHoursWeek: setup.settings.overtimeHoursWeek };
};

/** Name lookups for messages. */
export const nameOf = (setup: Pick<Setup, "staff">, id: string | null): string => (id ? setup.staff.find((p) => p.id === id)?.name ?? "—" : "—");
export const positionOf = (setup: Pick<Setup, "positions">, id: string): ShiftPosition | undefined => setup.positions.find((p) => p.id === id);

/** "Thứ 2 06/10 07:00–12:00 Pha chế": one line of a person's schedule. */
const WD = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];
export const dayLabel = (date: string): string => {
  const i = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  return `${WD[i]} ${date.slice(8, 10)}/${date.slice(5, 7)}`;
};
export const shiftLine = (setup: Pick<Setup, "positions">, sh: Shift): string => `${dayLabel(sh.date)} ${sh.start}–${sh.end} ${positionOf(setup, sh.positionId)?.name ?? ""}`.trim();
export const weekLabel = (monday: string): string => `${dayLabel(monday).slice(-5)} – ${dayLabel(addDays(monday, 6)).slice(-5)}`;
export { toMin, weekDates };
