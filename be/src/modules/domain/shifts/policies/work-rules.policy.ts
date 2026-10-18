import type { Env, Seg, Shift, ShiftStaff, Violation, ViolationKind } from "../shifts.contracts"
import { isAvailable, onLeave } from "./availability.policy"
import { DAY_MIN, dayDiff, toMin } from "./time.policy"

/** Hours beyond the week limit tolerate this much rounding (in minutes). */
const LIMIT_TOLERANCE_MIN = 0.01

/** A week's work beyond the overtime line is paid at this multiple. */
const OVERTIME_FACTOR = 1.5

/** One piece of work with its place in the order the caller gave it (-1 for work of the days before the week). */
interface Placed {
    readonly seg: Seg
    readonly index: number
    readonly violations: Array<Violation>
}

interface Checked<T> extends Placed {
    readonly item: T
}

/** The piece of work a shift stands for, in minutes. */
export const segOf = (shift: Shift): Seg => ({
    date: shift.date,
    s: toMin(shift.start),
    e: toMin(shift.end),
    pos: shift.positionId,
})

/** The shifts a person actually works: it has a person and was not cancelled. */
export const liveShifts = (shifts: ReadonlyArray<Shift>): Array<Shift & { readonly staffId: string }> =>
    shifts.flatMap((shift) =>
        shift.staffId !== null && shift.status !== "cancelled" ? [{ ...shift, staffId: shift.staffId }] : [],
    )

const byDayThenStart = (a: Placed, b: Placed): number => {
    if (a.seg.date === b.seg.date) return a.seg.s - b.seg.s
    return a.seg.date < b.seg.date ? -1 : 1
}

const byDayThenEnd = (a: Seg, b: Seg): number => {
    if (a.date === b.date) return a.e - b.e
    return a.date < b.date ? -1 : 1
}

const restViolation = (chrono: ReadonlyArray<Placed>, at: number, seg: Seg, minRest: number): Array<Violation> => {
    const before = chrono.slice(0, at).reverse()
    const previous = before.find((placed) => placed.seg.date !== seg.date)
    if (previous === undefined) return []
    const gap = dayDiff(previous.seg.date, seg.date) * DAY_MIN + seg.s - previous.seg.e
    return gap < minRest * 60 ? [{ kind: "rest", detail: `${(gap / 60).toFixed(1)}h` }] : []
}

const overlaps = (seg: Seg, index: number, ordered: ReadonlyArray<Placed>): boolean =>
    ordered.some((o) => o.index !== index && o.seg.date === seg.date && o.seg.s < seg.e && o.seg.e > seg.s)

const violationsOfOne = (
    env: Env,
    staff: ShiftStaff,
    placed: Placed,
    ordered: ReadonlyArray<Placed>,
    dayMinutes: number,
    weekMinutes: number,
): Array<Violation> => {
    const { seg, index } = placed
    const found: Array<[ViolationKind, string]> = []
    if (!staff.positionIds.includes(seg.pos)) found.push(["position", "position"])
    if (!isAvailable(env.avail, staff.id, seg.date, seg.s, seg.e)) found.push(["unavailable", "unavailable"])
    if (onLeave(env.leaves, staff.id, seg.date)) found.push(["leave", "leave"])
    if (overlaps(seg, index, ordered)) found.push(["overlap", "overlap"])
    if (dayMinutes > staff.maxDay * 60 + LIMIT_TOLERANCE_MIN)
        found.push(["max_day", `${(dayMinutes / 60).toFixed(1)}h`])
    if (weekMinutes > staff.maxWeek * 60 + LIMIT_TOLERANCE_MIN) {
        found.push(["max_week", `${(weekMinutes / 60).toFixed(1)}h`])
    }
    return found.map(([kind, detail]) => ({ kind, detail }))
}

const violationsForItems = <T>(
    env: Env,
    staffId: string,
    items: ReadonlyArray<T>,
    selectSeg: (item: T) => Seg,
): Array<Checked<T>> => {
    const out = items.map((item, index): Checked<T> => ({ item, seg: selectSeg(item), index, violations: [] }))
    const staff = env.staff.get(staffId)
    if (staff !== undefined) {
        const ordered = out.slice().sort(byDayThenStart)
        const prior = [...(env.prior?.get(staffId) ?? [])]
            .sort(byDayThenEnd)
            .map((seg): Placed => ({ seg, index: -1, violations: [] }))
        const chrono = [...prior, ...ordered]
        const days = new Map<string, number>()
        let week = 0
        chrono.forEach((placed, at) => {
            if (placed.index < 0) return
            const length = placed.seg.e - placed.seg.s
            week += length
            const day = (days.get(placed.seg.date) ?? 0) + length
            days.set(placed.seg.date, day)
            placed.violations.push(
                ...violationsOfOne(env, staff, placed, ordered, day, week),
                ...restViolation(chrono, at, placed.seg, staff.minRest),
            )
        })
    }
    return out
}

/**
 * Every rule broken by one person's work of the week, aligned to `segs` (index i holds the violations of segs[i]).
 * The cumulative rules (hours per day and per week) mark the pieces that push the total over the limit.
 */
export const violationsForSegs = (env: Env, staffId: string, segs: ReadonlyArray<Seg>): Array<Array<Violation>> =>
    violationsForItems(env, staffId, segs, (seg) => seg).map(({ violations }) => violations)

/** Groups the live shifts by person. */
export const shiftsByStaff = (shifts: ReadonlyArray<Shift>): Map<string, Array<Shift>> =>
    liveShifts(shifts).reduce(
        (by, shift) => by.set(shift.staffId, [...(by.get(shift.staffId) ?? []), shift]),
        new Map<string, Array<Shift>>(),
    )

/** Violations of every assigned shift: shift id to what is wrong. Open and cancelled shifts have none. */
export const violationsOfShifts = (env: Env, shifts: ReadonlyArray<Shift>): Map<string, Array<Violation>> => {
    const out = new Map<string, Array<Violation>>()
    shiftsByStaff(shifts).forEach((list, staffId) => {
        violationsForItems(env, staffId, list, segOf).forEach(({ item: shift, violations: mine }) => {
            if (mine.length > 0) out.set(shift.id, mine)
        })
    })
    return out
}

/** Total minutes of a set of pieces. */
export const minutesOf = (segs: ReadonlyArray<Seg>): number => segs.reduce((total, seg) => total + (seg.e - seg.s), 0)

/** Wage of one person for the week: hours times the hourly wage, with the hours beyond the overtime line paid +50%. */
export const weekCost = (staff: ShiftStaff, segs: ReadonlyArray<Seg>, overtimeHoursWeek: number): number => {
    const hours = minutesOf(segs) / 60
    const base = Math.min(hours, overtimeHoursWeek)
    const over = Math.max(0, hours - overtimeHoursWeek)
    return Math.round((base + over * OVERTIME_FACTOR) * staff.wage)
}

/** One person's minutes and wage in a week. */
export interface StaffCost {
    /** The person. */
    readonly staffId: string
    /** Minutes worked. */
    readonly minutes: number
    /** Wage for them. */
    readonly cost: number
}

/** The wage cost of a set of shifts. */
export interface LaborCost {
    /** The total. */
    readonly total: number
    /** The cost per person. */
    readonly byStaff: ReadonlyArray<StaffCost>
}

/** The wage of every person who has shifts in the set, and the total. */
export const laborCost = (env: Env, shifts: ReadonlyArray<Shift>): LaborCost => {
    const byStaff = [...shiftsByStaff(shifts)].flatMap(([staffId, list]) => {
        const staff = env.staff.get(staffId)
        if (staff === undefined) return []
        const segs = list.map(segOf)
        return [{ staffId, minutes: minutesOf(segs), cost: weekCost(staff, segs, env.overtimeHoursWeek) }]
    })
    return { total: byStaff.reduce((sum, row) => sum + row.cost, 0), byStaff }
}

/** Shifts that fall on one date and were not cancelled, earliest first. */
export const onDate = (shifts: ReadonlyArray<Shift>, date: string): Array<Shift> =>
    shifts
        .filter((shift) => shift.date === date && shift.status !== "cancelled")
        .sort((a, b) => a.start.localeCompare(b.start))
