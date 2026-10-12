/**
 * Lịch & ca làm: shared types and PURE helpers (no I/O, safe in client components). The same rule checks run in the solver, on the
 * server (before a swap or an assignment) and live in the workbench grid, so what the screen highlights is what the engine enforces.
 * Weekday convention: 0 = Monday ... 6 = Sunday. Dates are "YYYY-MM-DD", times "HH:MM", all shop-local (Asia/Ho_Chi_Minh).
 */

export const DAY_MIN = 1440;
export const CELL_MIN = 30;

export const toMin = (hm: string): number => {
  const m = /^(\d{1,2}):(\d{2})/.exec(hm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
};
export const fromMin = (n: number): string => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
export const hhmm = (t: string): string => fromMin(toMin(t));

export const addDays = (d: string, n: number): string => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
export const weekdayOf = (d: string): number => (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7;
export const mondayOf = (d: string): string => addDays(d, -weekdayOf(d));
export const weekDates = (monday: string): Array<string> => Array.from({ length: 7 }, (_, i) => addDays(monday, i));
export const dayDiff = (a: string, b: string): number => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
export const todayVn = (now = new Date()): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now);
/** The shop-local wall clock of an instant as { date, minute }. */
export const clockVn = (now = new Date()): { date: string; minute: number } => {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const num = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return { date: todayVn(now), minute: num("hour") * 60 + num("minute") };
};
/** The UTC instant of a shop-local date + minute (Vietnam has no DST: UTC+7). */
export const instantOf = (date: string, minute: number): Date => new Date(Date.parse(`${date}T00:00:00Z`) + (minute - 7 * 60) * 60_000);

export type ShiftPosition = { readonly id: string; readonly name: string; readonly color: string };
export type ShiftStaff = {
  readonly id: string; readonly name: string; readonly positionIds: ReadonlyArray<string>; readonly skills: ReadonlyArray<string>;
  readonly wage: number; readonly maxWeek: number; readonly maxDay: number; readonly minRest: number;
  readonly staffRowId: string | null; readonly telegramChatId: string | null; readonly zaloUserId: string | null; readonly phone: string | null;
  readonly active: boolean;
};
export type Avail = { readonly staffId: string; readonly weekday: number | null; readonly date: string | null; readonly start: string; readonly end: string; readonly available: boolean };
export type Block = { readonly id: string; readonly weekday: number; readonly start: string; readonly end: string; readonly positionId: string; readonly min: number; readonly ideal: number; readonly peak: boolean };
export type Leave = { readonly staffId: string; readonly from: string; readonly to: string };
export type Shift = { readonly id: string; readonly date: string; readonly start: string; readonly end: string; readonly positionId: string; readonly staffId: string | null; readonly status?: string };

/** One continuous piece of work of one person, in minutes. */
export type Seg = { date: string; s: number; e: number; pos: string };
export type Env = {
  readonly staff: ReadonlyMap<string, ShiftStaff>;
  readonly avail: ReadonlyArray<Avail>;
  readonly leaves: ReadonlyArray<Leave>;
  /** Work of the days just before the week (rest rule across the week boundary). */
  readonly prior?: ReadonlyMap<string, ReadonlyArray<Seg>>;
  readonly overtimeHoursWeek: number;
};

export type ViolationKind = "overlap" | "unavailable" | "leave" | "max_day" | "max_week" | "rest" | "position";
export type Violation = { readonly kind: ViolationKind; readonly detail: string };

export const segOf = (s: Shift): Seg => ({ date: s.date, s: toMin(s.start), e: toMin(s.end), pos: s.positionId });

/** True when [s, e] on `date` lies inside what the person said they can work. Recurring rows by weekday; a date override replaces them for that day. */
export const isAvailable = (avail: ReadonlyArray<Avail>, staffId: string, date: string, s: number, e: number): boolean => {
  const mine = avail.filter((a) => a.staffId === staffId);
  const over = mine.filter((a) => a.date === date);
  const rows = over.length ? over : mine.filter((a) => a.weekday === weekdayOf(date) && a.date === null);
  if (!rows.length) return true;
  const yes = rows.filter((r) => r.available);
  const no = rows.filter((r) => !r.available);
  if (no.some((r) => toMin(r.start) < e && toMin(r.end) > s)) return false;
  if (!yes.length) return true;
  // Positive windows may touch each other (e.g. 07-12 and 12-18): merge them before testing that [s, e] fits inside one.
  const w = yes.map((r) => [toMin(r.start), toMin(r.end)] as const).sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const [a, b] of w) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  return merged.some(([a, b]) => a <= s && b >= e);
};

export const onLeave = (leaves: ReadonlyArray<Leave>, staffId: string, date: string): boolean => leaves.some((l) => l.staffId === staffId && l.from <= date && l.to >= date);

const sortSegs = (segs: ReadonlyArray<Seg>): Array<{ seg: Seg; i: number }> =>
  segs.map((seg, i) => ({ seg, i })).sort((a, b) => (a.seg.date === b.seg.date ? a.seg.s - b.seg.s : a.seg.date < b.seg.date ? -1 : 1));

/**
 * Every rule broken by one person's work of the week, aligned to `segs` (index i = violations of segs[i]).
 * Cumulative rules (day and week hours) mark the pieces that push the total over the limit.
 */
export const violationsForSegs = (env: Env, staffId: string, segs: ReadonlyArray<Seg>): Array<Array<Violation>> => {
  const out: Array<Array<Violation>> = segs.map(() => []);
  const st = env.staff.get(staffId);
  if (!st) return out;
  const ordered = sortSegs(segs);
  let week = 0;
  const day = new Map<string, number>();
  const prior = [...(env.prior?.get(staffId) ?? [])].sort((a, b) => (a.date === b.date ? a.e - b.e : a.date < b.date ? -1 : 1));
  const chrono = [...prior.map((seg) => ({ seg, prior: true as const, i: -1 })), ...ordered.map((o) => ({ seg: o.seg, prior: false as const, i: o.i }))];
  chrono.forEach((cur, k) => {
    if (cur.prior) return;
    const { seg, i } = cur;
    const add = (kind: ViolationKind, detail: string) => out[i].push({ kind, detail });
    if (!st.positionIds.includes(seg.pos)) add("position", "position");
    if (!isAvailable(env.avail, staffId, seg.date, seg.s, seg.e)) add("unavailable", "unavailable");
    if (onLeave(env.leaves, staffId, seg.date)) add("leave", "leave");
    for (const o of ordered) if (o.i !== i && o.seg.date === seg.date && o.seg.s < seg.e && o.seg.e > seg.s) { add("overlap", "overlap"); break; }
    const len = seg.e - seg.s;
    week += len;
    const d = (day.get(seg.date) ?? 0) + len;
    day.set(seg.date, d);
    if (d > st.maxDay * 60 + 0.01) add("max_day", `${(d / 60).toFixed(1)}h`);
    if (week > st.maxWeek * 60 + 0.01) add("max_week", `${(week / 60).toFixed(1)}h`);
    // Rest: the previous piece that ended on an earlier day (same-day split shifts carry no rest rule).
    for (let j = k - 1; j >= 0; j--) {
      const p = chrono[j].seg;
      if (p.date === seg.date) continue;
      const gap = dayDiff(p.date, seg.date) * DAY_MIN + seg.s - p.e;
      if (gap < st.minRest * 60) add("rest", `${(gap / 60).toFixed(1)}h`);
      break;
    }
  });
  return out;
};

/** Violations of every assigned shift: shift id -> what is wrong. Open shifts (no person) have none. */
export const violationsOfShifts = (env: Env, shifts: ReadonlyArray<Shift>): Map<string, Array<Violation>> => {
  const out = new Map<string, Array<Violation>>();
  const by = new Map<string, Array<Shift>>();
  for (const s of shifts) if (s.staffId && s.status !== "cancelled") (by.get(s.staffId) ?? by.set(s.staffId, []).get(s.staffId)!).push(s);
  for (const [staffId, list] of by) {
    const v = violationsForSegs(env, staffId, list.map(segOf));
    list.forEach((s, i) => { if (v[i].length) out.set(s.id, v[i]); });
  }
  return out;
};

export const minutesOf = (segs: ReadonlyArray<Seg>): number => segs.reduce((n, s) => n + (s.e - s.s), 0);

/** Wage for the week of one person: hours x hourly wage, with the hours beyond the overtime line paid +50%. */
export const weekCost = (st: ShiftStaff, segs: ReadonlyArray<Seg>, overtimeHoursWeek: number): number => {
  const hrs = minutesOf(segs) / 60;
  const base = Math.min(hrs, overtimeHoursWeek);
  const over = Math.max(0, hrs - overtimeHoursWeek);
  return Math.round((base + over * 1.5) * st.wage);
};

export const laborCost = (env: Env, shifts: ReadonlyArray<Shift>): { total: number; byStaff: Map<string, { minutes: number; cost: number }> } => {
  const by = new Map<string, Array<Seg>>();
  for (const s of shifts) if (s.staffId && s.status !== "cancelled") (by.get(s.staffId) ?? by.set(s.staffId, []).get(s.staffId)!).push(segOf(s));
  const byStaff = new Map<string, { minutes: number; cost: number }>();
  let total = 0;
  for (const [id, segs] of by) {
    const st = env.staff.get(id);
    if (!st) continue;
    const cost = weekCost(st, segs, env.overtimeHoursWeek);
    total += cost;
    byStaff.set(id, { minutes: minutesOf(segs), cost });
  }
  return { total, byStaff };
};

export type CoverageStatus = "short" | "ok" | "over";
export type CoverageCell = { readonly blockId: string; readonly date: string; readonly positionId: string; readonly start: string; readonly end: string; readonly min: number; readonly ideal: number; readonly peak: boolean; readonly have: number; readonly status: CoverageStatus };

/** Per coverage block and day: the fewest people on duty in that position over the block's time (so one gap shows as "thiếu"). */
export const coverageOf = (blocks: ReadonlyArray<Block>, monday: string, shifts: ReadonlyArray<Shift>): Array<CoverageCell> => {
  const dates = weekDates(monday);
  const live = shifts.filter((s) => s.staffId && s.status !== "cancelled");
  const out: Array<CoverageCell> = [];
  for (const b of blocks) {
    const date = dates[b.weekday];
    const s0 = toMin(b.start);
    const e0 = toMin(b.end);
    const here = live.filter((s) => s.date === date && s.positionId === b.positionId);
    let have = Number.POSITIVE_INFINITY;
    for (let c = s0; c < e0; c += CELL_MIN) {
      const ce = Math.min(c + CELL_MIN, e0);
      const n = new Set(here.filter((s) => toMin(s.start) <= c && toMin(s.end) >= ce).map((s) => s.staffId)).size;
      have = Math.min(have, n);
    }
    if (!Number.isFinite(have)) have = 0;
    out.push({ blockId: b.id, date, positionId: b.positionId, start: b.start, end: b.end, min: b.min, ideal: b.ideal, peak: b.peak, have, status: have < b.min ? "short" : have > b.ideal ? "over" : "ok" });
  }
  return out;
};

/** Shifts that fall on one date, earliest first. */
export const onDate = (shifts: ReadonlyArray<Shift>, date: string): Array<Shift> => shifts.filter((s) => s.date === date && s.status !== "cancelled").sort((a, b) => a.start.localeCompare(b.start));

export type SolverReport = {
  readonly ms: number; readonly iterations: number; readonly costVnd: number; readonly shiftCount: number; readonly openCount: number;
  readonly shortages: ReadonlyArray<{ blockId: string; date: string; positionId: string; start: string; end: string; missing: number }>;
  readonly hoursByStaff: Readonly<Record<string, number>>;
  /** People who could cover a shortage if asked (unavailable that day, or over their weekly limit): suggestions for the owner, never applied. */
  readonly askCandidates: ReadonlyArray<{ blockId: string; date: string; staffId: string; why: "unavailable" | "over_hours" | "rest" | "other" }>;
};
