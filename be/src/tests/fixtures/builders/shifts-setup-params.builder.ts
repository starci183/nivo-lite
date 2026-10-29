import { builder } from "@starci/jest-preset"
import type { SaveCoverageParams, SaveShiftsAvailabilityParams, SaveShiftsSettingsParams } from "@modules/domain/shifts"

/** A shift joined with the state of its schedule, as the joined read answers it. */
interface ShiftWithScheduleRow {
    id: string
    scheduleId: string
    shiftDate: string
    startTime: string
    endTime: string
    positionId: string
    staffId: string | null
    status: string
    scheduleStatus: string
    weekStart: string
}

/** The published 08:00 to 10:00 shift of the first profile. */
export const shiftRowOf = builder<ShiftWithScheduleRow>({
    id: "shift-1",
    scheduleId: "schedule-1",
    shiftDate: "2026-10-12",
    startTime: "08:00",
    endTime: "10:00",
    positionId: "position-1",
    staffId: "profile-1",
    status: "published",
    scheduleStatus: "published",
    weekStart: "2026-10-12",
})

/** A coverage block for Sunday and Tuesday, 08:00 to 12:00. */
export const coverageOf = builder<SaveCoverageParams>({
    weekdays: [0, 2],
    start: "08:00",
    end: "12:00",
    positionId: "position-1",
    min: 1,
    ideal: 2,
    peak: false,
})

/** The shop rules with one open day and one closed day. */
export const settingsOf = builder<SaveShiftsSettingsParams>({
    swapNoticeHours: 12,
    leaveNoticeDays: 3,
    remindMinutes: 60,
    noshowMinutes: 15,
    overtimeHoursWeek: 40,
    openingHours: [
        { weekday: 0, open: "08:00", close: "22:00" },
        { weekday: 6, open: "", close: "" },
    ],
})

/** A weekly statement of the second profile. */
export const availabilityOf = builder<SaveShiftsAvailabilityParams>({
    staffId: "profile-2",
    weekday: 1,
    date: null,
    start: "08:00",
    end: "12:00",
    available: false,
    note: "  school  ",
})

/** The row a save query answers with. */
export interface SavedRow {
    /** The identifier of the saved row, or null when the row is not the workspace's. */
    readonly id: string | null
}

/** The result of `execute` of a save query. */
export interface SavedExecution {
    /** The rows the statement returned. */
    readonly raw: ReadonlyArray<SavedRow>
}

/** What a save query builder answers. */
export interface SavedAnswer {
    /** The result of `execute`. */
    readonly execute: SavedExecution
}

/** What a save query builder answers: one row with the given identifier. */
export const saved = (id: string | null): SavedAnswer => ({ execute: { raw: [{ id }] } })

/** What a save query builder answers when it wrote nothing. */
export const nothingSaved = { execute: { raw: [] } } as const
