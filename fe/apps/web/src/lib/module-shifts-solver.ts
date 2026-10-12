import {
  CELL_MIN, coverageOf, fromMin, isAvailable, laborCost, minutesOf, onLeave, toMin, violationsForSegs, weekCost, weekDates,
  type Avail, type Block, type Env, type Leave, type Seg, type Shift, type ShiftStaff, type SolverReport,
} from "./module-shifts-types";

/**
 * The schedule solver: deterministic, engine-free, no I/O, no AI. The schedule itself ALWAYS comes from here; OpenClaw only explains it afterwards.
 *
 * Method (greedy + repair, a few starts):
 *  1. Every coverage block of the week (weekday x time x position, min / ideal people) is filled one head at a time: the candidate who is
 *     qualified, available, not on leave and breaks no rule (overlap, hours per day / week, rest between days) and who adds the LEAST wage
 *     (extending a shift they already have costs only the extra hours; hours past the overtime line cost +50%) is picked; ties go to the person
 *     with the fewest hours so far (fair), then to the less flexible person (flexible people stay free for harder blocks).
 *  2. Hard blocks first (fewest possible people), peak blocks before the rest. Minimum heads are filled for every block, then the ideal heads of peak blocks.
 *  3. Repair: a block still short asks a qualified, available person who is blocked by their own other work to hand that work to someone else.
 *  4. The best of several starts (seeded shuffles of the block order) wins: fewest missing heads, then lowest cost, then fairest hours.
 *  What no one can cover becomes an OPEN shift (ca trống) that staff can ask for, and is listed in the report with the people worth asking.
 */

export type SolveInput = {
  readonly monday: string;
  readonly staff: ReadonlyArray<ShiftStaff>;
  readonly blocks: ReadonlyArray<Block>;
  readonly avail: ReadonlyArray<Avail>;
  readonly leaves: ReadonlyArray<Leave>;
  readonly prior?: ReadonlyMap<string, ReadonlyArray<Seg>>;
  readonly overtimeHoursWeek: number;
  readonly budgetMs?: number;
  readonly starts?: number;
};
export type SolveOutput = { readonly shifts: Array<Shift>; readonly report: SolverReport };

type Slot = { readonly block: Block; readonly date: string; readonly s: number; readonly e: number };
type State = Map<string, Array<Seg>>;

const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Add a piece of work, merging with same-position pieces it overlaps or touches. */
const withSeg = (list: ReadonlyArray<Seg>, seg: Seg): Array<Seg> => {
  let cur = { ...seg };
  const rest: Array<Seg> = [];
  for (const o of list) {
    if (o.date === cur.date && o.pos === cur.pos && o.s <= cur.e && o.e >= cur.s) cur = { date: cur.date, pos: cur.pos, s: Math.min(o.s, cur.s), e: Math.max(o.e, cur.e) };
    else rest.push(o);
  }
  rest.push(cur);
  return rest;
};

const covers = (list: ReadonlyArray<Seg>, date: string, pos: string, s: number, e: number) => list.some((g) => g.date === date && g.pos === pos && g.s <= s && g.e >= e);

const haveFor = (state: State, slot: Slot): number => {
  let have = Number.POSITIVE_INFINITY;
  for (let c = slot.s; c < slot.e; c += CELL_MIN) {
    const ce = Math.min(c + CELL_MIN, slot.e);
    let n = 0;
    for (const list of state.values()) if (covers(list, slot.date, slot.block.positionId, c, ce)) n++;
    have = Math.min(have, n);
  }
  return Number.isFinite(have) ? have : 0;
};

export const solveWeek = (input: SolveInput): SolveOutput => {
  const t0 = Date.now();
  const budget = input.budgetMs ?? 400;
  const staff = input.staff.filter((s) => s.active);
  const env: Env = { staff: new Map(staff.map((s) => [s.id, s])), avail: input.avail, leaves: input.leaves, prior: input.prior, overtimeHoursWeek: input.overtimeHoursWeek };
  const dates = weekDates(input.monday);
  // A block longer than one working day (e.g. "07:00-22:00") is cut into pieces of at most 8 hours that the same person can still take back to back.
  const slots: Array<Slot> = input.blocks.flatMap((b) => {
    const s0 = toMin(b.start);
    const e0 = toMin(b.end);
    const k = Math.max(1, Math.ceil((e0 - s0) / 480));
    const cut = (i: number) => (i === 0 ? s0 : i === k ? e0 : s0 + Math.round(((e0 - s0) * i) / k / CELL_MIN) * CELL_MIN);
    return Array.from({ length: k }, (_, i) => ({ block: b, date: dates[b.weekday], s: cut(i), e: cut(i + 1) })).filter((x) => x.e > x.s);
  });

  /** People who could ever work this block (qualified, free that day), used to order hard blocks first. */
  const possible = (sl: Slot) =>
    staff.filter((p) => p.positionIds.includes(sl.block.positionId) && !onLeave(env.leaves, p.id, sl.date) && isAvailable(env.avail, p.id, sl.date, sl.s, sl.e)).length;
  const hardness = new Map(slots.map((sl) => [sl, possible(sl)]));

  type Cand = { st: ShiftStaff; next: Array<Seg>; cost: number; minutes: number };
  /** The person's work with `seg` added when that breaks no rule, with what it costs. */
  const tryAdd = (state: State, p: ShiftStaff, seg: Seg): Cand | null => {
    const cur = state.get(p.id) ?? [];
    if (covers(cur, seg.date, seg.pos, seg.s, seg.e)) return null;
    const next = withSeg(cur, seg);
    const v = violationsForSegs(env, p.id, next);
    if (v.some((x) => x.length)) return null;
    return { st: p, next, cost: weekCost(p, next, env.overtimeHoursWeek) - weekCost(p, cur, env.overtimeHoursWeek), minutes: minutesOf(cur) };
  };

  const fill = (state: State, sl: Slot, target: number, rand: () => number, noise: number): number => {
    let have = haveFor(state, sl);
    let guard = 0;
    while (have < target && guard++ < 60) {
      const seg: Seg = { date: sl.date, s: sl.s, e: sl.e, pos: sl.block.positionId };
      const cands: Array<Cand> = [];
      for (const p of staff) {
        if (!p.positionIds.includes(seg.pos)) continue;
        const c = tryAdd(state, p, seg);
        if (c) cands.push(c);
      }
      if (!cands.length) break;
      cands.sort((a, b) => a.cost * (1 + (rand() - 0.5) * noise) - b.cost * (1 + (rand() - 0.5) * noise) || a.minutes - b.minutes || a.st.positionIds.length - b.st.positionIds.length || a.st.name.localeCompare(b.st.name));
      state.set(cands[0].st.id, cands[0].next);
      const now = haveFor(state, sl);
      if (now <= have) break;
      have = now;
    }
    return have;
  };

  /** A person who cannot take `seg` only because of other work they have: hand one of those pieces to somebody else, then take `seg`. */
  const repair = (state: State, sl: Slot): boolean => {
    const seg: Seg = { date: sl.date, s: sl.s, e: sl.e, pos: sl.block.positionId };
    for (const p of staff) {
      if (!p.positionIds.includes(seg.pos) || onLeave(env.leaves, p.id, seg.date) || !isAvailable(env.avail, p.id, seg.date, seg.s, seg.e)) continue;
      const cur = state.get(p.id) ?? [];
      if (covers(cur, seg.date, seg.pos, seg.s, seg.e)) continue;
      const pieces = [...cur].sort((a, b) => (a.date === seg.date ? 0 : 1) - (b.date === seg.date ? 0 : 1));
      for (const piece of pieces) {
        const without = cur.filter((x) => x !== piece);
        const takes = tryAdd(new Map([...state, [p.id, without]]), p, seg);
        if (!takes) continue;
        for (const q of staff) {
          if (q.id === p.id || !q.positionIds.includes(piece.pos)) continue;
          const moved = tryAdd(state, q, piece);
          if (!moved) continue;
          state.set(q.id, moved.next);
          state.set(p.id, takes.next);
          return true;
        }
      }
    }
    return false;
  };

  type Result = { state: State; short: number; idealGap: number; cost: number; spread: number };
  const run = (order: Array<Slot>, rand: () => number, noise: number): Result => {
    const state: State = new Map();
    for (const sl of order) fill(state, sl, sl.block.min, rand, noise);
    for (const sl of order) {
      let guard = 0;
      while (haveFor(state, sl) < sl.block.min && guard++ < 6) {
        if (!repair(state, sl)) break;
        fill(state, sl, sl.block.min, rand, noise);
      }
    }
    for (const sl of order) if (sl.block.peak && sl.block.ideal > sl.block.min) fill(state, sl, sl.block.ideal, rand, noise);
    let short = 0;
    let idealGap = 0;
    for (const sl of slots) {
      const have = haveFor(state, sl);
      const hrs = (sl.e - sl.s) / 60;
      short += Math.max(0, sl.block.min - have) * hrs;
      if (sl.block.peak) idealGap += Math.max(0, sl.block.ideal - have) * hrs;
    }
    let cost = 0;
    const minutes: Array<number> = [];
    for (const p of staff) {
      const segs = state.get(p.id) ?? [];
      cost += weekCost(p, segs, env.overtimeHoursWeek);
      if (segs.length) minutes.push(minutesOf(segs));
    }
    const spread = minutes.length ? Math.max(...minutes) - Math.min(...minutes) : 0;
    return { state, short, idealGap, cost, spread };
  };

  const better = (a: Result, b: Result) => a.short - b.short || a.idealGap - b.idealGap || a.cost - b.cost || a.spread - b.spread;
  const baseOrder = [...slots].sort((a, b) => (hardness.get(a)! - hardness.get(b)!) || Number(b.block.peak) - Number(a.block.peak) || a.date.localeCompare(b.date) || a.s - b.s);
  let best = run(baseOrder, () => 0.5, 0);
  let iterations = 1;
  const starts = input.starts ?? 24;
  for (let k = 1; k < starts && Date.now() - t0 < budget; k++) {
    const rand = rng(1000 + k * 7919);
    const order = [...slots].sort((a, b) => (hardness.get(a)! - hardness.get(b)!) + (rand() - 0.5) * 3 || Number(b.block.peak) - Number(a.block.peak));
    const r = run(order, rand, 0.25);
    iterations++;
    if (better(r, best) < 0) best = r;
  }

  // Shifts from the winning pieces, then open shifts for every head nobody could cover.
  const shifts: Array<Shift> = [];
  let n = 0;
  for (const [staffId, segs] of best.state) {
    for (const g of [...segs].sort((a, b) => (a.date === b.date ? a.s - b.s : a.date < b.date ? -1 : 1))) {
      shifts.push({ id: `new-${n++}`, date: g.date, start: fromMin(g.s), end: fromMin(g.e), positionId: g.pos, staffId, status: "draft" });
    }
  }
  const shortages: Array<SolverReport["shortages"][number]> = [];
  const askCandidates: Array<SolverReport["askCandidates"][number]> = [];
  for (const sl of slots) {
    const have = haveFor(best.state, sl);
    const missing = sl.block.min - have;
    if (missing <= 0) continue;
    shortages.push({ blockId: sl.block.id, date: sl.date, positionId: sl.block.positionId, start: fromMin(sl.s), end: fromMin(sl.e), missing });
    for (let i = 0; i < missing; i++) shifts.push({ id: `new-${n++}`, date: sl.date, start: fromMin(sl.s), end: fromMin(sl.e), positionId: sl.block.positionId, staffId: null, status: "draft" });
    // Who is worth asking: qualified, not on leave, who failed only on availability or hours.
    const seg: Seg = { date: sl.date, s: sl.s, e: sl.e, pos: sl.block.positionId };
    for (const p of staff) {
      if (!p.positionIds.includes(seg.pos) || onLeave(env.leaves, p.id, sl.date) || covers(best.state.get(p.id) ?? [], sl.date, seg.pos, sl.s, sl.e)) continue;
      const cur = best.state.get(p.id) ?? [];
      const v = violationsForSegs(env, p.id, withSeg(cur, seg)).flat().map((x) => x.kind);
      if (!v.length) continue;
      const why: "unavailable" | "over_hours" | "rest" | "other" = v.includes("unavailable") && v.every((k) => k === "unavailable") ? "unavailable"
        : v.every((k) => k === "max_day" || k === "max_week") ? "over_hours" : v.every((k) => k === "rest") ? "rest" : "other";
      if (why !== "other") askCandidates.push({ blockId: sl.block.id, date: sl.date, staffId: p.id, why });
    }
  }
  const cost = laborCost(env, shifts);
  const hoursByStaff: Record<string, number> = {};
  for (const [id, v] of cost.byStaff) hoursByStaff[id] = Math.round((v.minutes / 60) * 10) / 10;
  return {
    shifts,
    report: {
      ms: Date.now() - t0, iterations, costVnd: cost.total, shiftCount: shifts.filter((s) => s.staffId).length,
      openCount: shifts.filter((s) => !s.staffId).length, shortages, hoursByStaff, askCandidates,
    },
  };
};

/** Coverage cells of a solved week (same function the workbench uses live). */
export const coverageOfSolve = (blocks: ReadonlyArray<Block>, monday: string, shifts: ReadonlyArray<Shift>) => coverageOf(blocks, monday, shifts);
