import type {
    AskCandidate,
    AskReason,
    Block,
    Env,
    Seg,
    Shift,
    ShiftStaff,
    Shortage,
    SolveInput,
    SolveOutput,
} from "../shifts.contracts"
import { isAvailable, onLeave } from "./availability.policy"
import { CELL_MIN, fromMin, toMin, weekDates } from "./time.policy"
import { laborCost, minutesOf, violationsForSegs, weekCost } from "./work-rules.policy"

/** A block longer than one working day is cut into pieces of at most this many minutes. */
const SLOT_MAX_MIN = 480

/** The most heads one fill loop adds to one slot before it gives up. */
const FILL_GUARD = 60

/** The most repair rounds one short slot gets. */
const REPAIR_GUARD = 6

/** How strongly a random start perturbs the candidate costs. */
const START_NOISE = 0.25

/** A piece of a coverage block on one day. */
interface Slot {
    readonly block: Block
    readonly date: string
    readonly s: number
    readonly e: number
}

type State = Map<string, Array<Seg>>

/** A person who could take a piece: their work with it added, what it costs extra, and the minutes they already have. */
interface Candidate {
    readonly staff: ShiftStaff
    readonly next: Array<Seg>
    readonly cost: number
    readonly minutes: number
}

/** The score of one finished start. */
interface Result {
    readonly state: State
    readonly short: number
    readonly idealGap: number
    readonly cost: number
    readonly spread: number
}

/** A small deterministic random generator (mulberry32) so a run is repeatable. */
const generator = (seed: number): (() => number) => {
    let state = seed
    return () => {
        state = (state + 0x6d2b79f5) | 0
        let t = Math.imul(state ^ (state >>> 15), 1 | state)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

/** Adds a piece of work, merging with the same-position pieces it overlaps or touches. */
const withSeg = (list: ReadonlyArray<Seg>, seg: Seg): Array<Seg> => {
    const touching = (o: Seg) => o.date === seg.date && o.pos === seg.pos && o.s <= seg.e && o.e >= seg.s
    const merged = list
        .filter(touching)
        .reduce<Seg>(
            (cur, o) => ({ date: cur.date, pos: cur.pos, s: Math.min(o.s, cur.s), e: Math.max(o.e, cur.e) }),
            seg,
        )
    return [...list.filter((o) => !touching(o)), merged]
}

const covers = (list: ReadonlyArray<Seg>, date: string, pos: string, s: number, e: number): boolean =>
    list.some((g) => g.date === date && g.pos === pos && g.s <= s && g.e >= e)

const segOfSlot = (slot: Slot): Seg => ({ date: slot.date, s: slot.s, e: slot.e, pos: slot.block.positionId })

const haveFor = (state: State, slot: Slot): number => {
    const counts: Array<number> = []
    for (let cell = slot.s; cell < slot.e; cell += CELL_MIN) {
        const cellEnd = Math.min(cell + CELL_MIN, slot.e)
        let people = 0
        for (const list of state.values()) {
            if (covers(list, slot.date, slot.block.positionId, cell, cellEnd)) people += 1
        }
        counts.push(people)
    }
    return counts.length === 0 ? 0 : Math.min(...counts)
}

/** The slots of a block: a block longer than one working day is cut into pieces the same person can still take back to back. */
const slotsOf = (block: Block, dates: ReadonlyArray<string>): Array<Slot> => {
    const from = toMin(block.start)
    const to = toMin(block.end)
    const parts = Math.max(1, Math.ceil((to - from) / SLOT_MAX_MIN))
    const cut = (i: number): number => {
        if (i === 0) return from
        if (i === parts) return to
        return from + Math.round(((to - from) * i) / parts / CELL_MIN) * CELL_MIN
    }
    const date = dates[block.weekday] ?? ""
    return Array.from({ length: parts }, (_, i) => ({ block, date, s: cut(i), e: cut(i + 1) })).filter((x) => x.e > x.s)
}

/** Orders pieces of work by day, then by start. */
const byDateThenStart = (a: Seg, b: Seg): number => {
    if (a.date === b.date) return a.s - b.s
    return a.date < b.date ? -1 : 1
}

/** The reason a person who could ever cover a shortage was left out. */
const whyNot = (kinds: ReadonlyArray<string>): AskReason => {
    if (kinds.includes("unavailable") && kinds.every((k) => k === "unavailable")) return "unavailable"
    if (kinds.every((k) => k === "max_day" || k === "max_week")) return "over_hours"
    return kinds.every((k) => k === "rest") ? "rest" : "other"
}

/**
 * The schedule solver: deterministic, no I/O, no AI. The schedule itself always comes from here; the model only explains it afterwards.
 * Greedy fill with repair over a few seeded starts: each head goes to the qualified, available person who adds the least wage (ties to
 * the fewest hours so far, then to the less flexible person); hard blocks first, peak blocks before the rest; the best start wins
 * (fewest missing heads, then peak gap, then cost, then fairness). What no one can cover becomes an open shift.
 */
export const solveWeek = (input: SolveInput): SolveOutput => {
    const startedAt = input.nowMs()
    const staff = input.staff.filter((s) => s.active)
    const env: Env = {
        staff: new Map(staff.map((s) => [s.id, s])),
        avail: input.avail,
        leaves: input.leaves,
        prior: input.prior,
        overtimeHoursWeek: input.overtimeHoursWeek,
    }
    const dates = weekDates(input.monday)
    const slots = input.blocks.flatMap((block) => slotsOf(block, dates))
    const hardness = new Map(
        slots.map((slot) => [
            slot,
            staff.filter(
                (p) =>
                    p.positionIds.includes(slot.block.positionId) &&
                    !onLeave(env.leaves, p.id, slot.date) &&
                    isAvailable(env.avail, p.id, slot.date, slot.s, slot.e),
            ).length,
        ]),
    )
    const hard = (slot: Slot): number => hardness.get(slot) ?? 0

    const tryAdd = (state: State, person: ShiftStaff, seg: Seg): Candidate | null => {
        const cur = state.get(person.id) ?? []
        if (covers(cur, seg.date, seg.pos, seg.s, seg.e)) return null
        const next = withSeg(cur, seg)
        if (violationsForSegs(env, person.id, next).some((x) => x.length > 0)) return null
        const extra = weekCost(person, next, env.overtimeHoursWeek) - weekCost(person, cur, env.overtimeHoursWeek)
        return { staff: person, next, cost: extra, minutes: minutesOf(cur) }
    }

    const fill = (state: State, slot: Slot, target: number, rand: () => number, noise: number): void => {
        let have = haveFor(state, slot)
        for (let guard = 0; have < target && guard < FILL_GUARD; guard++) {
            const seg = segOfSlot(slot)
            const jitter = (cost: number): number => cost * (1 + (rand() - 0.5) * noise)
            const candidates = staff
                .filter((p) => p.positionIds.includes(seg.pos))
                .flatMap((p) => {
                    const c = tryAdd(state, p, seg)
                    return c === null ? [] : [c]
                })
                .sort(
                    (a, b) =>
                        jitter(a.cost) - jitter(b.cost) ||
                        a.minutes - b.minutes ||
                        a.staff.positionIds.length - b.staff.positionIds.length ||
                        a.staff.name.localeCompare(b.staff.name),
                )
            const best = candidates[0]
            if (best === undefined) break
            state.set(best.staff.id, best.next)
            const now = haveFor(state, slot)
            if (now <= have) break
            have = now
        }
    }

    /** A person who cannot take the piece only because of other work they have: hand one of those pieces to somebody else, then take it. */
    const repair = (state: State, slot: Slot): boolean => {
        const seg = segOfSlot(slot)
        for (const person of staff) {
            if (!person.positionIds.includes(seg.pos) || onLeave(env.leaves, person.id, seg.date)) continue
            if (!isAvailable(env.avail, person.id, seg.date, seg.s, seg.e)) continue
            const cur = state.get(person.id) ?? []
            if (covers(cur, seg.date, seg.pos, seg.s, seg.e)) continue
            const pieces = [...cur].sort((a, b) => Number(a.date !== seg.date) - Number(b.date !== seg.date))
            for (const piece of pieces) {
                const takes = tryAdd(new Map([...state, [person.id, cur.filter((x) => x !== piece)]]), person, seg)
                if (takes === null) continue
                for (const other of staff) {
                    if (other.id === person.id || !other.positionIds.includes(piece.pos)) continue
                    const moved = tryAdd(state, other, piece)
                    if (moved === null) continue
                    state.set(other.id, moved.next)
                    state.set(person.id, takes.next)
                    return true
                }
            }
        }
        return false
    }

    const score = (state: State): Result => {
        let short = 0
        let idealGap = 0
        for (const slot of slots) {
            const have = haveFor(state, slot)
            const hours = (slot.e - slot.s) / 60
            short += Math.max(0, slot.block.min - have) * hours
            if (slot.block.peak) idealGap += Math.max(0, slot.block.ideal - have) * hours
        }
        const worked = staff.map((p) => state.get(p.id) ?? [])
        const cost = staff.reduce((sum, p, i) => sum + weekCost(p, worked[i] ?? [], env.overtimeHoursWeek), 0)
        const minutes = worked.filter((segs) => segs.length > 0).map(minutesOf)
        const spread = minutes.length > 0 ? Math.max(...minutes) - Math.min(...minutes) : 0
        return { state, short, idealGap, cost, spread }
    }

    const run = (order: ReadonlyArray<Slot>, rand: () => number, noise: number): Result => {
        const state: State = new Map()
        for (const slot of order) fill(state, slot, slot.block.min, rand, noise)
        for (const slot of order) {
            for (let guard = 0; haveFor(state, slot) < slot.block.min && guard < REPAIR_GUARD; guard++) {
                if (!repair(state, slot)) break
                fill(state, slot, slot.block.min, rand, noise)
            }
        }
        for (const slot of order) {
            if (slot.block.peak && slot.block.ideal > slot.block.min) fill(state, slot, slot.block.ideal, rand, noise)
        }
        return score(state)
    }

    const better = (a: Result, b: Result): number =>
        a.short - b.short || a.idealGap - b.idealGap || a.cost - b.cost || a.spread - b.spread
    const baseOrder = [...slots].sort(
        (a, b) =>
            hard(a) - hard(b) ||
            Number(b.block.peak) - Number(a.block.peak) ||
            a.date.localeCompare(b.date) ||
            a.s - b.s,
    )
    let best = run(baseOrder, () => 0.5, 0)
    let iterations = 1
    for (let k = 1; k < input.starts && input.nowMs() - startedAt < input.budgetMs; k++) {
        const rand = generator(1000 + k * 7919)
        const order = [...slots].sort(
            (a, b) => hard(a) - hard(b) + (rand() - 0.5) * 3 || Number(b.block.peak) - Number(a.block.peak),
        )
        const result = run(order, rand, START_NOISE)
        iterations += 1
        if (better(result, best) < 0) best = result
    }
    return finish(input, env, staff, slots, best.state, iterations, startedAt, whyNot)
}

/** Shifts from the winning pieces, then an open shift for every head nobody could cover, and the report. */
const finish = (
    input: SolveInput,
    env: Env,
    staff: ReadonlyArray<ShiftStaff>,
    slots: ReadonlyArray<Slot>,
    state: State,
    iterations: number,
    startedAt: number,
    why: (kinds: ReadonlyArray<string>) => AskReason,
): SolveOutput => {
    const assigned = [...state].flatMap(([staffId, segs]) =>
        [...segs]
            .sort(byDateThenStart)
            .map((g): Shift => ({
                id: "",
                date: g.date,
                start: fromMin(g.s),
                end: fromMin(g.e),
                positionId: g.pos,
                staffId,
                status: "draft",
            })),
    )
    const shortages: Array<Shortage> = []
    const asks: Array<AskCandidate> = []
    const open: Array<Shift> = []
    for (const slot of slots) {
        const missing = slot.block.min - haveFor(state, slot)
        if (missing <= 0) continue
        shortages.push({
            blockId: slot.block.id,
            date: slot.date,
            positionId: slot.block.positionId,
            start: fromMin(slot.s),
            end: fromMin(slot.e),
            missing,
        })
        for (let i = 0; i < missing; i++) {
            open.push({
                id: "",
                date: slot.date,
                start: fromMin(slot.s),
                end: fromMin(slot.e),
                positionId: slot.block.positionId,
                staffId: null,
                status: "draft",
            })
        }
        const seg = segOfSlot(slot)
        for (const person of staff) {
            const cur = state.get(person.id) ?? []
            if (!person.positionIds.includes(seg.pos) || onLeave(env.leaves, person.id, slot.date)) continue
            if (covers(cur, slot.date, seg.pos, slot.s, slot.e)) continue
            const kinds = violationsForSegs(env, person.id, withSeg(cur, seg))
                .flat()
                .map((v) => v.kind)
            const reason = why(kinds)
            if (kinds.length > 0 && reason !== "other")
                asks.push({ blockId: slot.block.id, date: slot.date, staffId: person.id, why: reason })
        }
    }
    const shifts = [...assigned, ...open].map((shift, index): Shift => ({ ...shift, id: `new-${index}` }))
    const cost = laborCost(env, shifts)
    return {
        shifts,
        report: {
            ms: input.nowMs() - startedAt,
            iterations,
            costVnd: cost.total,
            shiftCount: shifts.filter((s) => s.staffId !== null).length,
            openCount: shifts.filter((s) => s.staffId === null).length,
            shortages,
            hoursByStaff: cost.byStaff.map((row) => ({
                staffId: row.staffId,
                hours: Math.round((row.minutes / 60) * 10) / 10,
            })),
            askCandidates: asks,
        },
    }
}
