import type { Block, Shift, ShiftStaff, SolveInput, SolverReport } from "@modules/domain/shifts"
/** Shared, complete test data for the capability cases. */
export const person = (values: Partial<ShiftStaff> = {}): ShiftStaff => ({
    id: "a",
    name: "Alex",
    positionIds: ["bar"],
    skills: [],
    wage: 30000,
    maxWeek: 40,
    maxDay: 8,
    minRest: 11,
    staffRowId: null,
    telegramChatId: null,
    zaloUserId: null,
    phone: null,
    active: true,
    ...values,
})

/** Shared, complete test data for the capability cases. */
export const block = (values: Partial<Block> = {}): Block => ({
    id: "block-1",
    weekday: 0,
    start: "07:00",
    end: "11:00",
    positionId: "bar",
    min: 1,
    ideal: 1,
    peak: false,
    ...values,
})

/** Shared, complete test data for the capability cases. */
export const inputOf = (values: Partial<SolveInput> = {}): SolveInput => ({
    monday: "2026-10-12",
    staff: [person()],
    blocks: [block()],
    avail: [],
    leaves: [],
    prior: new Map(),
    overtimeHoursWeek: 40,
    nowMs: () => 1000,
    budgetMs: 100,
    starts: 1,
    ...values,
})

/** Shared, complete test data for the capability cases. */
export const shift = (values: Partial<Shift> = {}): Shift => ({
    id: "new-0",
    date: "2026-10-12",
    start: "07:00",
    end: "11:00",
    positionId: "bar",
    staffId: "a",
    status: "draft",
    ...values,
})

/** Shared, complete test data for the capability cases. */
export const report = (values: Partial<SolverReport> = {}): SolverReport => ({
    ms: 0,
    iterations: 1,
    costVnd: 120000,
    shiftCount: 1,
    openCount: 0,
    shortages: [],
    hoursByStaff: [{ staffId: "a", hours: 4 }],
    askCandidates: [],
    ...values,
})
