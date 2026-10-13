import { liveByStaff, workPieceOf, ruleBreaksOf } from "@/hooks/shiftsRules"
import type { ShiftsRuleEnv, ShiftsViolationKind } from "@/hooks/shiftsRules"
import { clockMinutes, isoWeekDates } from "@/hooks/shiftsTime"
import type { ShiftsBenchView, ShiftsBlockView, ShiftsShiftView, ShiftsStaffView } from "@/modules/types"

const CELL_MIN = 30

/** Wage of one person for the week: hours x hourly wage, with the hours beyond the overtime line paid +50%. */
const weekCost = (person: ShiftsStaffView, minutes: number, overtimeHoursWeek: number): number => {
    const hours = minutes / 60
    const overtime = Math.max(0, hours - overtimeHoursWeek)
    return Math.round((Math.min(hours, overtimeHoursWeek) + overtime * 1.5) * person.wage)
}

/** Hours and wages by person and the wage total of the week. */
interface LaborCost {
    readonly total: number
    readonly byStaff: ReadonlyMap<string, { readonly minutes: number; readonly cost: number }>
}

const laborCost = (env: ShiftsRuleEnv, shifts: ReadonlyArray<ShiftsShiftView>): LaborCost => {
    const byStaff = new Map<string, { minutes: number; cost: number }>()
    let total = 0
    for (const [staffId, list] of liveByStaff(shifts)) {
        const person = env.staff.get(staffId)
        if (person === undefined) continue
        const minutes = list.map(workPieceOf).reduce((sum, seg) => sum + seg.e - seg.s, 0)
        const cost = weekCost(person, minutes, env.overtimeHoursWeek)
        total += cost
        byStaff.set(staffId, { minutes, cost })
    }
    return { total, byStaff }
}

/** One coverage block of one date: the fewest people on duty over its time against the minimum and the ideal. */
export interface ShiftsCoverageCell {
    readonly blockId: string
    readonly date: string
    readonly positionId: string
    readonly start: string
    readonly end: string
    readonly min: number
    readonly ideal: number
    readonly peak: boolean
    readonly have: number
    readonly status: "short" | "ok" | "over"
}

const coverageStatus = (have: number, block: ShiftsBlockView): ShiftsCoverageCell["status"] => {
    if (have < block.min) return "short"
    return have > block.ideal ? "over" : "ok"
}

const peopleOnDuty = (here: ReadonlyArray<ShiftsShiftView>, from: number, to: number): number => {
    let have = Number.POSITIVE_INFINITY
    for (let cell = from; cell < to; cell += CELL_MIN) {
        const cellEnd = Math.min(cell + CELL_MIN, to)
        const covering = here.filter((s) => clockMinutes(s.start) <= cell && clockMinutes(s.end) >= cellEnd)
        have = Math.min(have, new Set(covering.map((s) => s.staffId)).size)
    }
    return Number.isFinite(have) ? have : 0
}

const coverageOf = (
    blocks: ReadonlyArray<ShiftsBlockView>,
    monday: string,
    shifts: ReadonlyArray<ShiftsShiftView>,
): Array<ShiftsCoverageCell> => {
    const dates = isoWeekDates(monday)
    const live = shifts.filter((shift) => shift.staffId !== null && shift.status !== "cancelled")
    return blocks.map((block) => {
        const date = dates[block.weekday] ?? monday
        const here = live.filter((shift) => shift.date === date && shift.positionId === block.positionId)
        const have = peopleOnDuty(here, clockMinutes(block.start), clockMinutes(block.end))
        return {
            blockId: block.id,
            date,
            positionId: block.positionId,
            start: block.start,
            end: block.end,
            min: block.min,
            ideal: block.ideal,
            peak: block.peak,
            have,
            status: coverageStatus(have, block),
        }
    })
}

/** The derived facts of one week with the pending moves applied: shifts, rule breaks, coverage and wages. */
export interface ShiftsWeekModel {
    readonly shifts: ReadonlyArray<ShiftsShiftView>
    readonly broken: ReadonlyMap<string, ReadonlyArray<ShiftsViolationKind>>
    readonly cells: ReadonlyArray<ShiftsCoverageCell>
    readonly cost: LaborCost
}

/** Computes the week model of a bench; `moves` maps a shift id to the person it was just given to (`null` = open). */
export const weekModelOf = (
    bench: ShiftsBenchView,
    moves: Readonly<Record<string, string | null>>,
): ShiftsWeekModel => {
    const { setup, week } = bench
    const shifts = week.shifts.map((shift) =>
        shift.id in moves ? { ...shift, staffId: moves[shift.id] ?? null } : shift,
    )
    const env: ShiftsRuleEnv = {
        staff: new Map(setup.staff.map((person) => [person.id, person])),
        avail: week.approvedAvail,
        leaves: week.approvedLeaves,
        prior: new Map(Object.entries(week.prior)),
        overtimeHoursWeek: setup.settings.overtimeHoursWeek,
    }
    return {
        shifts,
        broken: ruleBreaksOf(env, shifts),
        cells: coverageOf(setup.blocks, week.monday, shifts),
        cost: laborCost(env, shifts),
    }
}
