import { clockMinutes, dayGap, isoWeekdayIndex } from "@/hooks/shiftsTime"
import type {
    ShiftsAvailView,
    ShiftsLeaveSpanView,
    ShiftsSegView,
    ShiftsShiftView,
    ShiftsStaffView,
} from "@/modules/types"

const DAY_MIN = 1440

/** The rules a shift can break. */
export type ShiftsViolationKind = "overlap" | "unavailable" | "leave" | "max_day" | "max_week" | "rest" | "position"

/** What the rule checks read: the roster, the approved availability and leave, and the work just before the week. */
export interface ShiftsRuleEnv {
    readonly staff: ReadonlyMap<string, ShiftsStaffView>
    readonly avail: ReadonlyArray<ShiftsAvailView>
    readonly leaves: ReadonlyArray<ShiftsLeaveSpanView>
    readonly prior: ReadonlyMap<string, ReadonlyArray<ShiftsSegView>>
    readonly overtimeHoursWeek: number
}

/** A shift as a piece of work in minutes of its date. */
export const workPieceOf = (shift: ShiftsShiftView): ShiftsSegView => ({
    date: shift.date,
    s: clockMinutes(shift.start),
    e: clockMinutes(shift.end),
    pos: shift.positionId,
})

/** The shifts that count (assigned and not cancelled), grouped by person. */
export const liveByStaff = (shifts: ReadonlyArray<ShiftsShiftView>): Map<string, Array<ShiftsShiftView>> => {
    const by = new Map<string, Array<ShiftsShiftView>>()
    for (const shift of shifts) {
        if (shift.staffId === null || shift.status === "cancelled") continue
        by.set(shift.staffId, [...(by.get(shift.staffId) ?? []), shift])
    }
    return by
}

/** True when [s, e] on `date` lies inside what the person said they can work; a date row replaces the weekday rows of that day. */
const isAvailable = (
    avail: ReadonlyArray<ShiftsAvailView>,
    staffId: string,
    date: string,
    s: number,
    e: number,
): boolean => {
    const mine = avail.filter((row) => row.staffId === staffId)
    const dated = mine.filter((row) => row.date === date)
    const rows =
        dated.length > 0 ? dated : mine.filter((row) => row.weekday === isoWeekdayIndex(date) && row.date === null)
    if (rows.length === 0) return true
    const blocked = rows.filter((row) => !row.available)
    if (blocked.some((row) => clockMinutes(row.start) < e && clockMinutes(row.end) > s)) return false
    const windows = rows
        .filter((row) => row.available)
        .map((row) => ({ from: clockMinutes(row.start), to: clockMinutes(row.end) }))
        .sort((a, b) => a.from - b.from)
    if (windows.length === 0) return true
    const merged: Array<{ from: number; to: number }> = []
    for (const window of windows) {
        const last = merged.at(-1)
        if (last !== undefined && window.from <= last.to) last.to = Math.max(last.to, window.to)
        else merged.push({ ...window })
    }
    return merged.some((window) => window.from <= s && window.to >= e)
}

const byDayThenStart = (a: ShiftsSegView, b: ShiftsSegView): number => a.date.localeCompare(b.date) || a.s - b.s

/** The rules broken by one person's work of the week, aligned to `segs`; day and week limits mark the pieces that push the total over. */
const violationsForSegs = (
    env: ShiftsRuleEnv,
    staffId: string,
    segs: ReadonlyArray<ShiftsSegView>,
): Array<Array<ShiftsViolationKind>> => {
    const out: Array<Array<ShiftsViolationKind>> = segs.map(() => [])
    const person = env.staff.get(staffId)
    if (person === undefined) return out
    const ordered = segs.map((seg, index) => ({ seg, index })).sort((a, b) => byDayThenStart(a.seg, b.seg))
    const prior = [...(env.prior.get(staffId) ?? [])].sort((a, b) => a.date.localeCompare(b.date) || a.e - b.e)
    const chrono = [...prior.map((seg) => ({ seg, index: -1 })), ...ordered]
    const perDay = new Map<string, number>()
    let week = 0
    chrono.forEach((current, position) => {
        if (current.index < 0) return
        const { seg, index } = current
        const add = (kind: ShiftsViolationKind) => out[index]?.push(kind)
        if (!person.positionIds.includes(seg.pos)) add("position")
        if (!isAvailable(env.avail, staffId, seg.date, seg.s, seg.e)) add("unavailable")
        if (env.leaves.some((leave) => leave.staffId === staffId && leave.from <= seg.date && leave.to >= seg.date))
            add("leave")
        if (ordered.some((o) => o.index !== index && o.seg.date === seg.date && o.seg.s < seg.e && o.seg.e > seg.s))
            add("overlap")
        week += seg.e - seg.s
        const day = (perDay.get(seg.date) ?? 0) + seg.e - seg.s
        perDay.set(seg.date, day)
        if (day > person.maxDay * 60 + 0.01) add("max_day")
        if (week > person.maxWeek * 60 + 0.01) add("max_week")
        const before = chrono
            .slice(0, position)
            .reverse()
            .find((item) => item.seg.date !== seg.date)
        if (before === undefined) return
        const gap = dayGap(before.seg.date, seg.date) * DAY_MIN + seg.s - before.seg.e
        if (gap < person.minRest * 60) add("rest")
    })
    return out
}

/** Violations of every assigned shift: shift id -> what is wrong. Open shifts have none. */
export const ruleBreaksOf = (
    env: ShiftsRuleEnv,
    shifts: ReadonlyArray<ShiftsShiftView>,
): Map<string, Array<ShiftsViolationKind>> => {
    const out = new Map<string, Array<ShiftsViolationKind>>()
    for (const [staffId, list] of liveByStaff(shifts)) {
        const found = violationsForSegs(env, staffId, list.map(workPieceOf))
        list.forEach((shift, index) => {
            const kinds = found[index] ?? []
            if (kinds.length > 0) out.set(shift.id, kinds)
        })
    }
    return out
}
