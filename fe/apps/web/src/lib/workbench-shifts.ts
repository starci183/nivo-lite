import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { currentSchedule, loadShifts, loadSchedules } from "./module-shifts-data";
import { addDays, mondayOf, toMin, todayVn } from "./module-shifts-types";

/**
 * Shifts workbench figures (read side), the four numbers of the agent dashboard ribbon. Every figure comes from a table the module already keeps
 * (shifts_schedules, shifts_shifts, shifts_leave_requests); nothing is estimated and no wage is read.
 */
type Db = SupabaseClient;

export type ShiftsFigures = {
  /** Shifts of this week's current schedule (the open draft, else the published one): how many have a person, how many in all. `hasSchedule` is false when the week has none. */
  readonly week: { readonly filled: number; readonly total: number; readonly hasSchedule: boolean };
  /** Published shifts from today over the next 14 days that no one has yet (the open shifts staff may ask for). */
  readonly openGaps: number;
  /** Leave requests waiting for the manager. */
  readonly leavePending: number;
  /** Hours of the published shifts that have a person, dated this month (Vietnam calendar). Scheduled time, not clocked time. */
  readonly hoursMonth: number;
};

const GAP_DAYS = 14;
const MONTH_ROW_LIMIT = 5000;

const monthBounds = (today: string): { from: string; to: string } => {
  const from = `${today.slice(0, 7)}-01`;
  const next = addDays(from, 31);
  return { from, to: `${next.slice(0, 7)}-01` };
};

export const getShiftsFigures = async (db: Db, ws: string): Promise<ShiftsFigures> => {
  const today = todayVn();
  const monday = mondayOf(today);
  const month = monthBounds(today);

  const [schedules, gaps, leaves, monthRows] = await Promise.all([
    loadSchedules(db, ws, monday),
    db.from("shifts_shifts").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("status", "published").is("staff_id", null).gte("shift_date", today).lte("shift_date", addDays(today, GAP_DAYS)),
    db.from("shifts_leave_requests").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("status", "pending"),
    db.from("shifts_shifts").select("start_time, end_time").eq("workspace_id", ws).in("status", ["published", "swapped"]).not("staff_id", "is", null).gte("shift_date", month.from).lt("shift_date", month.to).limit(MONTH_ROW_LIMIT),
  ]);
  if (gaps.error) throw new Error(gaps.error.message);
  if (leaves.error) throw new Error(leaves.error.message);
  if (monthRows.error) throw new Error(monthRows.error.message);

  const current = currentSchedule(schedules);
  const shifts = current ? await loadShifts(db, ws, current.id) : [];
  const minutes = ((monthRows.data ?? []) as Array<{ start_time: string; end_time: string }>).reduce((n, r) => n + Math.max(0, toMin(r.end_time) - toMin(r.start_time)), 0);

  return {
    week: { filled: shifts.filter((s) => s.staffId).length, total: shifts.length, hasSchedule: current !== null },
    openGaps: gaps.count ?? 0,
    leavePending: leaves.count ?? 0,
    hoursMonth: Math.round(minutes / 6) / 10,
  };
};
