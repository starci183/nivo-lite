import type { Block, CoverageCell, CoverageStatus, Shift } from "../shifts.contracts"
import { liveShifts } from "./work-rules.policy"
import { CELL_MIN, toMin, weekDates } from "./time.policy"

const statusOf = (have: number, block: Block): CoverageStatus => {
    if (have < block.min) return "short"
    return have > block.ideal ? "over" : "ok"
}

/** The people on duty in one position on one day at every half hour of a window, as the fewest of them. */
export const fewestOnDuty = (
    live: ReadonlyArray<Shift>,
    date: string,
    positionId: string,
    from: number,
    to: number,
): number => {
    const here = live.filter((shift) => shift.date === date && shift.positionId === positionId)
    const counts: Array<number> = []
    for (let cell = from; cell < to; cell += CELL_MIN) {
        const cellEnd = Math.min(cell + CELL_MIN, to)
        const people = here.filter((shift) => toMin(shift.start) <= cell && toMin(shift.end) >= cellEnd)
        counts.push(new Set(people.map((shift) => shift.staffId)).size)
    }
    return counts.length === 0 ? 0 : Math.min(...counts)
}

/** Per coverage block and day: the fewest people on duty in that position over the block's time, so one gap shows as short. */
export const coverageOf = (
    blocks: ReadonlyArray<Block>,
    monday: string,
    shifts: ReadonlyArray<Shift>,
): Array<CoverageCell> => {
    const dates = weekDates(monday)
    const live = liveShifts(shifts)
    return blocks.map((block) => {
        const date = dates[block.weekday] ?? monday
        const have = fewestOnDuty(live, date, block.positionId, toMin(block.start), toMin(block.end))
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
            status: statusOf(have, block),
        }
    })
}
