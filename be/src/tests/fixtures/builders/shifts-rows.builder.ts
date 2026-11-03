import { entityRowBuilder } from "./entity-row.builder"

/** A schedule version of the week of 12 October as the table stores it. */
interface ScheduleRow {
    id: string
    weekStart: string
    version: number
    status: string
    source: string
    costVnd: string
    explanation: string
    solverMs: number
    summary: object | null
    evidence: object | null
    workItemId: string | null
    createdAt: Date
    publishedAt: Date | null
}

/** A shift of the schedule as the table stores it. */
interface ShiftRow {
    id: string
    shiftDate: string
    startTime: string
    endTime: string
    positionId: string
    staffId: string | null
    status: string
}

/** A leave request as the table stores it. */
interface LeaveRow {
    id: string
    staffId: string
    fromDate: string
    toDate: string
    reason: string
    status: string
    workItemId: string | null
    createdAt: Date
}

/** A swap request as the table stores it. */
interface SwapRow {
    id: string
    kind: string
    shiftId: string
    fromStaffId: string
    toStaffId: string | null
    reason: string
    status: string
    checks: ReadonlyArray<string> | object
    workItemId: string | null
    createdAt: Date
}

/** An availability statement as the table stores it. */
interface AvailabilityRow {
    id: string
    staffId: string
    weekday: number | null
    shiftDate: string | null
    startTime: string
    endTime: string
    available: boolean
    note: string
    status: string
    createdAt: Date
}

type ScheduleRowOfShape = {
    readonly id?: string
    readonly weekStart?: string
    readonly version?: number
    readonly status?: string
    readonly source?: string
    readonly costVnd?: string
    readonly explanation?: string
    readonly solverMs?: number
    readonly summary?: object | null
    readonly evidence?: object | null
    readonly workItemId?: string | null
    readonly createdAt?: Date
    readonly publishedAt?: Date | null
}

/** The current draft of the week of 12 October. */
export const scheduleRowOf: (changes?: ScheduleRowOfShape) => ScheduleRow = entityRowBuilder<ScheduleRow>({
    id: "schedule-2",
    weekStart: "2026-10-12",
    version: 2,
    status: "draft",
    source: "solver",
    costVnd: "120000",
    explanation: "Why",
    solverMs: 40,
    summary: { gaps: 0 },
    evidence: { source: "saved" },
    workItemId: "item-1",
    createdAt: new Date("2026-10-13T01:00:00.000Z"),
    publishedAt: null,
})

/** The first, published version of the same week. */
export const olderScheduleRow = (): ScheduleRow =>
    scheduleRowOf({ id: "schedule-1", version: 1, status: "published", workItemId: null })

/** A published schedule with no work item behind it. */
export const publishedScheduleRow = (): ScheduleRow => scheduleRowOf({ status: "published", workItemId: null })

/** A published schedule that kept no cost, summary or evidence. */
export const bareScheduleRow = (): ScheduleRow =>
    scheduleRowOf({ status: "published", costVnd: "0", summary: null, evidence: null })

type ShiftRowOfShape = {
    readonly id?: string
    readonly shiftDate?: string
    readonly startTime?: string
    readonly endTime?: string
    readonly positionId?: string
    readonly staffId?: string | null
    readonly status?: string
}

/** The 08:00 to 10:00 shift of Cashier on Wednesday 14 October, held by the first profile. */
export const shiftRowOf: (changes?: ShiftRowOfShape) => ShiftRow = entityRowBuilder<ShiftRow>({
    id: "shift-1",
    shiftDate: "2026-10-14",
    startTime: "08:00:00",
    endTime: "10:00:00",
    positionId: "position-1",
    staffId: "profile-1",
    status: "published",
})

/** The same shift with nobody on it. */
export const openShiftRow = (): ShiftRow => shiftRowOf({ id: "shift-2", staffId: null })

/** The same shift held by the second profile. */
export const colleagueShiftRow = (): ShiftRow => shiftRowOf({ id: "shift-3", staffId: "profile-2" })

/** The same shift on the next day. */
export const nextDayShiftRow = (): ShiftRow => shiftRowOf({ id: "shift-4", shiftDate: "2026-10-15" })

/** A shift of a position the setup does not have. */
export const strayShiftRow = (): ShiftRow => shiftRowOf({ positionId: "absent" })

type LeaveRowOfShape = {
    readonly id?: string
    readonly staffId?: string
    readonly fromDate?: string
    readonly toDate?: string
    readonly reason?: string
    readonly status?: string
    readonly workItemId?: string | null
    readonly createdAt?: Date
}

/** A pending leave with a work item. */
export const leaveRowOf: (changes?: LeaveRowOfShape) => LeaveRow = entityRowBuilder<LeaveRow>({
    id: "leave-1",
    staffId: "profile-1",
    fromDate: "2026-10-20",
    toDate: "2026-10-21",
    reason: "Trip",
    status: "pending",
    workItemId: "item-2",
    createdAt: new Date("2026-10-13T02:00:00.000Z"),
})

/** A leave filed without a work item. */
export const unlinkedLeaveRow = (): LeaveRow => leaveRowOf({ workItemId: null })

/** A leave whose work item is gone. */
export const orphanLeaveRow = (): LeaveRow => leaveRowOf({ id: "leave-2", workItemId: "absent" })

type SwapRowOfShape = {
    readonly id?: string
    readonly kind?: string
    readonly shiftId?: string
    readonly fromStaffId?: string
    readonly toStaffId?: string | null
    readonly reason?: string
    readonly status?: string
    readonly checks?: ReadonlyArray<string> | object
    readonly workItemId?: string | null
    readonly createdAt?: Date
}

/** A pending swap with no work item. */
export const swapRowOf: (changes?: SwapRowOfShape) => SwapRow = entityRowBuilder<SwapRow>({
    id: "swap-1",
    kind: "swap",
    shiftId: "shift-1",
    fromStaffId: "profile-1",
    toStaffId: "profile-2",
    reason: "Exam",
    status: "pending",
    checks: [],
    workItemId: null,
    createdAt: new Date("2026-10-13T03:00:00.000Z"),
})

/** A swap with a work item and a finding of the rule checks. */
export const noticeSwapRow = (): SwapRow => swapRowOf({ workItemId: "item-1", checks: ["Notice short"] })

/** A swap of a shift and a work item that are gone. */
export const orphanSwapRow = (): SwapRow => swapRowOf({ id: "swap-2", shiftId: "absent", workItemId: "absent" })

type AvailabilityRowOfShape = {
    readonly id?: string
    readonly staffId?: string
    readonly weekday?: number | null
    readonly shiftDate?: string | null
    readonly startTime?: string
    readonly endTime?: string
    readonly available?: boolean
    readonly note?: string
    readonly status?: string
    readonly createdAt?: Date
}

/** A weekly statement approved for the first profile. */
export const availabilityRowOf: (changes?: AvailabilityRowOfShape) => AvailabilityRow =
    entityRowBuilder<AvailabilityRow>({
        id: "avail-1",
        staffId: "profile-1",
        weekday: 2,
        shiftDate: null,
        startTime: "08:00:00",
        endTime: "12:00:00",
        available: false,
        note: "School",
        status: "approved",
        createdAt: new Date("2026-10-01T00:00:00.000Z"),
    })
