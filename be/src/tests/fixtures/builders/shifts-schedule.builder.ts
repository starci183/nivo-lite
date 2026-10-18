import { builder } from "@starci/jest-preset"
import type { ProposeWeekOutput, Block, Shift, ShiftStaff } from "@modules/domain/shifts"

/** Renders localization keys and parameters deterministically for expected views. */
export const text = (key: string, params: Record<string, string | number> = {}): string =>
    `${key}${JSON.stringify(params)}`

export const staffOf = builder<ShiftStaff>({
    id: "staff-1",
    name: "Alex",
    positionIds: ["position-1"],
    skills: [],
    wage: 30000,
    maxWeek: 40,
    maxDay: 8,
    minRest: 12,
    staffRowId: null,
    telegramChatId: null,
    zaloUserId: null,
    phone: null,
    active: true,
})

export const blockOf = builder<Block>({
    id: "block-1",
    weekday: 0,
    start: "08:00",
    end: "10:00",
    positionId: "position-1",
    min: 1,
    ideal: 1,
    peak: false,
})

export const shiftOf = builder<Shift>({
    id: "shift-1",
    date: "2026-10-12",
    start: "08:00",
    end: "10:00",
    positionId: "position-1",
    staffId: "staff-1",
    status: "draft",
})

export const proposalOf = builder<ProposeWeekOutput>({
    scheduleId: "schedule-1",
    version: 3,
    shifts: 1,
    open: 0,
    short: 0,
    costVnd: 60000,
    ms: 0,
    iterations: 6,
})

export const savedCoverage =
    `{"coverage":[{"blockId":"block-1","date":"2026-10-12","positionId":"position-1",` +
    `"start":"08:00","end":"10:00","min":1,"ideal":1,"peak":false,"have":1,"status":"ok"}],` +
    `"hours":[{"staffId":"staff-1","hours":2}]}`

export const savedSolver =
    `{"solver":{"ms":0,"iterations":6,"costVnd":60000,"shiftCount":1,"openCount":0,"shortages":[],` +
    `"hoursByStaff":[{"staffId":"staff-1","hours":2}],"askCandidates":[]}}`

export const emptyExplanation = text("shifts.explain.fallback", {
    week: "week:2026-10-12",
    version: 1,
    shifts: 0,
    open: 0,
    cost: "0\u0111",
    short: "shifts.explain.shortNone{}",
})

export const shortageShiftParams = [
    "ws-1",
    "schedule-1",
    ["2026-10-12", "2026-10-12"],
    ["08:00", "08:00"],
    ["10:00", "10:00"],
    ["position-1", "position-1"],
    ["staff-1", null],
    "solver",
]
