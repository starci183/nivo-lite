import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  currentSchedule, loadAvailability, loadEnv, loadLeaves, loadSchedules, loadSetup, loadShifts, loadSwaps, toShift,
  type AvailRow, type LeaveRow, type ScheduleRow, type Setup, type SwapRow,
} from "./module-shifts-data";
import { addDays, mondayOf, todayVn, type Avail, type Leave, type Seg, type Shift } from "./module-shifts-types";

/** Plain-data views for the workbench (everything here is JSON-safe: it crosses into client components). */
type Db = SupabaseClient;
type R = Record<string, unknown>;

export type WorkItemLite = { readonly id: string; readonly status: string; readonly summary: string; readonly resultSummary: string | null; readonly decidedPath: string | null };

export type WeekData = {
  readonly monday: string;
  readonly versions: ReadonlyArray<Pick<ScheduleRow, "id" | "version" | "status" | "costVnd" | "createdAt" | "publishedAt">>;
  readonly current: ScheduleRow | null;
  readonly shifts: ReadonlyArray<Shift>;
  readonly publishItem: WorkItemLite | null;
  readonly checkins: Readonly<Record<string, string>>;
  readonly approvedAvail: ReadonlyArray<Avail>;
  readonly approvedLeaves: ReadonlyArray<Leave>;
  readonly prior: Readonly<Record<string, ReadonlyArray<Seg>>>;
};

export type RequestsData = {
  readonly leaves: ReadonlyArray<LeaveRow & { item: WorkItemLite | null }>;
  readonly swaps: ReadonlyArray<SwapRow & { item: WorkItemLite | null; shiftLine: string }>;
  readonly availability: ReadonlyArray<AvailRow>;
};

export type BenchData = {
  readonly role: "owner" | "manager" | "staff";
  readonly today: string;
  readonly setup: Setup;
  readonly myProfileId: string | null;
  readonly reminderOn: boolean;
  readonly week: WeekData;
  readonly requests: RequestsData;
  /** Staff of the workspace's `staff` table that are not linked to a shifts profile yet (for the "link" choice in setup). */
  readonly staffRows: ReadonlyArray<{ id: string; name: string }>;
  readonly allAvailability: ReadonlyArray<AvailRow>;
};

const itemOf = (r: R | undefined | null): WorkItemLite | null => {
  if (!r) return null;
  const p = (r.proposal as { summary?: string } | null) ?? {};
  const res = (r.result as { summary?: string } | null) ?? null;
  return { id: String(r.id), status: String(r.status), summary: String(p.summary ?? ""), resultSummary: res?.summary ?? null, decidedPath: (r.decided_path as string | null) ?? null };
};

export const loadItems = async (db: Db, ids: ReadonlyArray<string>): Promise<Map<string, WorkItemLite>> => {
  const out = new Map<string, WorkItemLite>();
  if (!ids.length) return out;
  const { data } = await db.from("work_items").select("id, status, proposal, result, decided_path").in("id", [...ids]);
  for (const r of (data ?? []) as Array<R>) {
    const it = itemOf(r);
    if (it) out.set(it.id, it);
  }
  return out;
};

export const loadWeek = async (db: Db, ws: string, monday: string, setup: Setup, isManager: boolean): Promise<WeekData> => {
  const week = mondayOf(monday);
  const all = await loadSchedules(db, ws, week);
  const current = currentSchedule(all);
  const shifts = current ? await loadShifts(db, ws, current.id) : [];
  const env = await loadEnv(db, ws, week, setup);
  const items = current?.workItemId ? await loadItems(db, [current.workItemId]) : new Map<string, WorkItemLite>();
  const att = shifts.length && isManager
    ? (((await db.from("shifts_attendance").select("shift_id, checked_in_at").eq("workspace_id", ws).in("shift_id", shifts.map((s) => s.id))).data ?? []) as Array<{ shift_id: string; checked_in_at: string }>)
    : [];
  return {
    monday: week,
    versions: all.map((s) => ({ id: s.id, version: s.version, status: s.status, costVnd: s.costVnd, createdAt: s.createdAt, publishedAt: s.publishedAt })),
    current: isManager ? current : current && current.status === "published" ? { ...current, evidence: {}, summary: {} } : null,
    shifts,
    publishItem: current?.workItemId ? items.get(current.workItemId) ?? null : null,
    checkins: Object.fromEntries(att.map((a) => [a.shift_id, a.checked_in_at])),
    approvedAvail: env.avail,
    approvedLeaves: env.leaves,
    prior: Object.fromEntries([...(env.prior ?? new Map()).entries()]),
  };
};

export const loadRequests = async (db: Db, ws: string, setup: Setup, filter: { staffId?: string } = {}): Promise<RequestsData> => {
  const [leaves, swaps, avail] = await Promise.all([
    loadLeaves(db, ws, { staffId: filter.staffId }),
    loadSwaps(db, ws),
    loadAvailability(db, ws, { staffId: filter.staffId }),
  ]);
  const ids = [...leaves.map((l) => l.workItemId), ...swaps.map((s) => s.workItemId)].filter((x): x is string => Boolean(x));
  const items = await loadItems(db, ids);
  const shiftIds = [...new Set(swaps.map((s) => s.shiftId))];
  const shifts = new Map<string, Shift>();
  if (shiftIds.length) for (const r of ((await db.from("shifts_shifts").select("*").in("id", shiftIds)).data ?? []) as Array<R>) shifts.set(String(r.id), toShift(r));
  const pos = new Map(setup.positions.map((p) => [p.id, p.name]));
  return {
    leaves: leaves.map((l) => ({ ...l, item: l.workItemId ? items.get(l.workItemId) ?? null : null })),
    swaps: swaps.filter((s) => !filter.staffId || s.fromStaffId === filter.staffId || s.toStaffId === filter.staffId).map((s) => {
      const sh = shifts.get(s.shiftId);
      return { ...s, item: s.workItemId ? items.get(s.workItemId) ?? null : null, shiftLine: sh ? `${sh.date.slice(8, 10)}/${sh.date.slice(5, 7)} ${sh.start}–${sh.end} ${pos.get(sh.positionId) ?? ""}`.trim() : "—" };
    }),
    availability: avail,
  };
};

export const loadBench = async (db: Db, ws: string, role: "owner" | "manager" | "staff", userId: string, monday?: string): Promise<BenchData> => {
  const isManager = role !== "staff";
  const today = todayVn();
  const setup = await loadSetup(db, ws, { withPay: isManager });
  const profile = (await db.rpc("shifts_my_profile", { ws })).data as string | null;
  const myProfileId = profile ?? null;
  const week = await loadWeek(db, ws, monday ?? today, setup, isManager);
  const requests = await loadRequests(db, ws, setup, isManager ? {} : { staffId: myProfileId ?? "00000000-0000-0000-0000-000000000000" });
  const rem = (await db.from("automation_pipelines").select("enabled").eq("workspace_id", ws).eq("template_key", "shifts_shift_reminder").maybeSingle()).data as { enabled?: boolean } | null;
  const rows = isManager ? (((await db.from("staff").select("id, name").eq("workspace_id", ws).eq("active", true).order("created_at")).data ?? []) as Array<{ id: string; name: string }>) : [];
  void userId;
  return { role, today, setup, myProfileId, reminderOn: Boolean(rem?.enabled), week, requests, staffRows: rows, allAvailability: isManager ? await loadAvailability(db, ws) : [] };
};

/** The signed-in person's own view: what they work in the next two weeks, open shifts they may ask for, check-ins. */
export type MineData = {
  readonly profileId: string | null;
  readonly today: string;
  readonly myShifts: ReadonlyArray<Shift & { checkedIn: boolean }>;
  readonly openShifts: ReadonlyArray<Shift>;
  readonly colleagues: ReadonlyArray<{ id: string; name: string; positionIds: ReadonlyArray<string> }>;
  readonly availability: ReadonlyArray<AvailRow>;
  readonly leaves: ReadonlyArray<LeaveRow & { item: WorkItemLite | null }>;
  readonly swaps: ReadonlyArray<SwapRow & { item: WorkItemLite | null; shiftLine: string }>;
};

export const loadMine = async (db: Db, ws: string, setup: Setup, profileId: string | null): Promise<MineData> => {
  const today = todayVn();
  if (!profileId) return { profileId, today, myShifts: [], openShifts: [], colleagues: [], availability: [], leaves: [], swaps: [] };
  const to = addDays(today, 14);
  const rows = ((await db.from("shifts_shifts").select("*").eq("workspace_id", ws).gte("shift_date", today).lte("shift_date", to).in("status", ["published", "swapped"]).order("shift_date").order("start_time")).data ?? []) as Array<R>;
  const shifts = rows.map(toShift);
  const mineIds = shifts.filter((s) => s.staffId === profileId).map((s) => s.id);
  const att = mineIds.length ? (((await db.from("shifts_attendance").select("shift_id").eq("workspace_id", ws).in("shift_id", mineIds)).data ?? []) as Array<{ shift_id: string }>) : [];
  const checked = new Set(att.map((a) => a.shift_id));
  const requests = await loadRequests(db, ws, setup, { staffId: profileId });
  return {
    profileId, today,
    myShifts: shifts.filter((s) => s.staffId === profileId).map((s) => ({ ...s, checkedIn: checked.has(s.id) })),
    openShifts: shifts.filter((s) => !s.staffId),
    colleagues: setup.staff.filter((p) => p.active && p.id !== profileId).map((p) => ({ id: p.id, name: p.name, positionIds: p.positionIds })),
    availability: requests.availability, leaves: requests.leaves, swaps: requests.swaps,
  };
};
