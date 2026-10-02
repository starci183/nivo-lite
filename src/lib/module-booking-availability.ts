/**
 * Booking availability engine: PURE (no I/O, no imports), so the app, the signed routes and the production check scripts all run the same code.
 * It answers one question: which start times are free for a service, given the resources' weekly hours, the date exceptions, the bookings that
 * already hold a resource (each blocks duration + buffer) and the policy (step, minimum lead time, how far ahead). Capacity counts customers at
 * the same moment, so a room for 4 can take four parallel bookings. The database re-checks every insert (booking_reserve), this only plans.
 */
export type Resource = { readonly id: string; readonly name: string; readonly kind: string; readonly capacity: number; readonly active: boolean; readonly sort?: number };
export type WeeklyHours = { readonly resourceId: string; readonly weekday: number; readonly start: string; readonly end: string };
export type DateException = { readonly resourceId: string | null; readonly date: string; readonly closed: boolean; readonly start?: string | null; readonly end?: string | null };
export type ServiceSpec = { readonly id: string; readonly durationMin: number; readonly bufferMin: number; readonly resourceKind: string | null; readonly active?: boolean };
/** A booking (or an external block, e.g. a staff leave) that takes `partySize` of a resource from `startMs` until `blockEndMs`. */
export type Taken = { readonly id?: string; readonly resourceId: string; readonly startMs: number; readonly blockEndMs: number; readonly partySize: number };
export type Policy = { readonly timezone: string; readonly slotStepMin: number; readonly minLeadMin: number; readonly maxAdvanceDays: number };
export type Slot = { readonly startMs: number; readonly endMs: number; readonly blockEndMs: number; readonly resourceId: string };

export type FindInput = {
  readonly service: ServiceSpec;
  readonly resources: ReadonlyArray<Resource>;
  readonly hours: ReadonlyArray<WeeklyHours>;
  readonly exceptions: ReadonlyArray<DateException>;
  readonly taken: ReadonlyArray<Taken>;
  readonly policy: Policy;
  readonly fromMs: number;
  readonly toMs: number;
  readonly nowMs: number;
  readonly partySize?: number;
  /** Only this resource (a customer who asks for "chị Mai"). */
  readonly resourceId?: string | null;
  /** The booking being moved: it does not block itself. */
  readonly excludeId?: string | null;
};

/* ------------------------------------------------------------------ time zone */

const parts = (ms: number, tz: string) => {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const o: Record<string, number> = {};
  for (const p of f.formatToParts(new Date(ms))) if (p.type !== "literal") o[p.type] = Number(p.value);
  return o;
};

/** Offset of the zone from UTC at an instant, in minutes. */
export const tzOffsetMin = (ms: number, tz: string): number => {
  const p = parts(ms, tz);
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000) / 60_000);
};

/** The instant of a wall-clock time ("2026-10-08", "09:30") in a zone. */
export const zonedMs = (date: string, hhmm: string, tz: string): number => {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let ms = guess - tzOffsetMin(guess, tz) * 60_000;
  ms = guess - tzOffsetMin(ms, tz) * 60_000;
  return ms;
};

/** "YYYY-MM-DD" of an instant in a zone. */
export const localDate = (ms: number, tz: string): string => {
  const p = parts(ms, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
};
export const localHhmm = (ms: number, tz: string): string => {
  const p = parts(ms, tz);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};
/** ISO weekday of a "YYYY-MM-DD": 1 = Monday ... 7 = Sunday. */
export const isoWeekday = (date: string): number => {
  const [y, m, d] = date.split("-").map(Number);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return w === 0 ? 7 : w;
};
export const addDays = (date: string, n: number): string => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const hhmm = (t: string): string => t.slice(0, 5);

/* ------------------------------------------------------------------ the day of one resource */

/** The windows (in ms) a resource works on one local date: its exception, else the business exception, else its weekly hours. */
export const windowsOf = (r: Resource, date: string, hours: ReadonlyArray<WeeklyHours>, exceptions: ReadonlyArray<DateException>, tz: string): Array<{ readonly startMs: number; readonly endMs: number }> => {
  const own = exceptions.filter((e) => e.date === date && e.resourceId === r.id);
  const all = exceptions.filter((e) => e.date === date && e.resourceId === null);
  const exc = own.length ? own : all;
  if (exc.some((e) => e.closed)) return [];
  const open = exc.filter((e) => !e.closed && e.start && e.end);
  const raw = open.length
    ? open.map((e) => ({ start: hhmm(String(e.start)), end: hhmm(String(e.end)) }))
    : hours.filter((h) => h.resourceId === r.id && h.weekday === isoWeekday(date)).map((h) => ({ start: hhmm(h.start), end: hhmm(h.end) }));
  return raw.map((w) => ({ startMs: zonedMs(date, w.start, tz), endMs: zonedMs(date, w.end, tz) })).filter((w) => w.endMs > w.startMs).sort((a, b) => a.startMs - b.startMs);
};

/** Most customers at one moment inside [startMs, blockEndMs) on a resource. */
export const peakLoad = (taken: ReadonlyArray<Taken>, resourceId: string, startMs: number, blockEndMs: number, excludeId?: string | null): number => {
  const mine = taken.filter((t) => t.resourceId === resourceId && t.id !== excludeId && t.startMs < blockEndMs && t.blockEndMs > startMs);
  if (!mine.length) return 0;
  const points = [startMs, ...mine.map((t) => t.startMs).filter((s) => s > startMs && s < blockEndMs)];
  let peak = 0;
  for (const at of points) peak = Math.max(peak, mine.filter((t) => t.startMs <= at && t.blockEndMs > at).reduce((n, t) => n + t.partySize, 0));
  return peak;
};

const eligible = (input: Pick<FindInput, "service" | "resources" | "resourceId">): ReadonlyArray<Resource> =>
  input.resources
    .filter((r) => r.active && (input.resourceId ? r.id === input.resourceId : true) && (input.service.resourceKind ? r.kind === input.service.resourceKind : true))
    .slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name));

/** Why there is no slot at all: a plain-words reason for the customer or the owner. */
export type Why = "no_service" | "no_resource" | "too_soon" | "too_far" | "closed" | "full" | "free";

/* ------------------------------------------------------------------ the engine */

export const findSlots = (input: FindInput): Array<Slot> => {
  const { service, hours, exceptions, taken, policy, nowMs } = input;
  const party = Math.max(1, input.partySize ?? 1);
  if (service.active === false) return [];
  const earliest = nowMs + policy.minLeadMin * 60_000;
  const latest = nowMs + policy.maxAdvanceDays * 86_400_000;
  const from = Math.max(input.fromMs, earliest);
  const to = Math.min(input.toMs, latest);
  if (to <= from) return [];
  const step = Math.max(5, policy.slotStepMin) * 60_000;
  const dur = service.durationMin * 60_000;
  const buf = service.bufferMin * 60_000;
  const out: Array<Slot> = [];
  const firstDate = addDays(localDate(from, policy.timezone), -1);
  const lastDate = addDays(localDate(to, policy.timezone), 1);
  for (const r of eligible(input)) {
    if (r.capacity < party) continue;
    for (let date = firstDate; date <= lastDate; date = addDays(date, 1)) {
      for (const w of windowsOf(r, date, hours, exceptions, policy.timezone)) {
        for (let s = w.startMs; s + dur <= w.endMs; s += step) {
          if (s < from || s >= to) continue;
          if (peakLoad(taken, r.id, s, s + dur + buf, input.excludeId) + party > r.capacity) continue;
          out.push({ startMs: s, endMs: s + dur, blockEndMs: s + dur + buf, resourceId: r.id });
        }
      }
    }
  }
  return out.sort((a, b) => a.startMs - b.startMs || a.resourceId.localeCompare(b.resourceId));
};

/** Slots of a whole local day. */
export const findDaySlots = (input: Omit<FindInput, "fromMs" | "toMs"> & { readonly date: string }): Array<Slot> =>
  findSlots({ ...input, fromMs: zonedMs(input.date, "00:00", input.policy.timezone), toMs: zonedMs(addDays(input.date, 1), "00:00", input.policy.timezone) });

/** One free resource at an exact start, or the reason there is none. Prefers the resource with the least load, then the first in order. */
export const checkSlot = (input: Omit<FindInput, "fromMs" | "toMs"> & { readonly startMs: number }): { readonly ok: true; readonly slot: Slot } | { readonly ok: false; readonly why: Why } => {
  if (input.service.active === false) return { ok: false, why: "no_service" };
  const res = eligible(input);
  if (!res.length) return { ok: false, why: "no_resource" };
  if (input.startMs < input.nowMs + input.policy.minLeadMin * 60_000) return { ok: false, why: "too_soon" };
  if (input.startMs > input.nowMs + input.policy.maxAdvanceDays * 86_400_000) return { ok: false, why: "too_far" };
  const slots = findSlots({ ...input, fromMs: input.startMs, toMs: input.startMs + 1 }).filter((s) => s.startMs === input.startMs);
  if (slots.length) {
    const party = Math.max(1, input.partySize ?? 1);
    const best = slots.slice().sort((a, b) => peakLoad(input.taken, a.resourceId, a.startMs, a.blockEndMs, input.excludeId) * 1000 / (res.find((r) => r.id === a.resourceId)?.capacity ?? party) - peakLoad(input.taken, b.resourceId, b.startMs, b.blockEndMs, input.excludeId) * 1000 / (res.find((r) => r.id === b.resourceId)?.capacity ?? party))[0];
    return { ok: true, slot: best };
  }
  // Why not: is the business open at all around that time (hours/exception), or is it just taken?
  const date = localDate(input.startMs, input.policy.timezone);
  const dur = input.service.durationMin * 60_000;
  let opened = false;
  for (const r of res) {
    for (const w of windowsOf(r, date, input.hours, input.exceptions, input.policy.timezone)) {
      if (input.startMs >= w.startMs && input.startMs + dur <= w.endMs) opened = true;
    }
  }
  return { ok: false, why: opened ? "full" : "closed" };
};

/** The nearest free start times (distinct moments) around a wanted time, to offer the customer: at most `n`, sorted by distance. */
export const nearestSlots = (input: Omit<FindInput, "fromMs" | "toMs"> & { readonly wantedMs: number; readonly n?: number; readonly spanDays?: number }): Array<Slot> => {
  const span = (input.spanDays ?? 7) * 86_400_000;
  const all = findSlots({ ...input, fromMs: input.wantedMs - span / 2, toMs: input.wantedMs + span });
  const seen = new Set<number>();
  const distinct: Array<Slot> = [];
  for (const s of all.sort((a, b) => Math.abs(a.startMs - input.wantedMs) - Math.abs(b.startMs - input.wantedMs) || a.startMs - b.startMs)) {
    if (seen.has(s.startMs)) continue;
    seen.add(s.startMs);
    distinct.push(s);
    if (distinct.length >= (input.n ?? 3)) break;
  }
  return distinct.sort((a, b) => a.startMs - b.startMs);
};

/** Booked minutes over open minutes for one resource and date range (workbench "utilisation"). */
export const utilisation = (resources: ReadonlyArray<Resource>, hours: ReadonlyArray<WeeklyHours>, exceptions: ReadonlyArray<DateException>, bookedByResource: ReadonlyMap<string, number>, fromDate: string, toDate: string, tz: string): Array<{ readonly resourceId: string; readonly openMin: number; readonly bookedMin: number; readonly pct: number }> =>
  resources.filter((r) => r.active).map((r) => {
    let open = 0;
    for (let d = fromDate; d <= toDate; d = addDays(d, 1)) for (const w of windowsOf(r, d, hours, exceptions, tz)) open += (w.endMs - w.startMs) / 60_000;
    const booked = bookedByResource.get(r.id) ?? 0;
    return { resourceId: r.id, openMin: open, bookedMin: booked, pct: open > 0 ? Math.min(100, Math.round((booked / (open * r.capacity)) * 100)) : 0 };
  });
