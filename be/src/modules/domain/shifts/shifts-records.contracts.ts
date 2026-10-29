import type { ShiftsShiftEntity } from "./persistence/entities"

/** A shift together with the state of the schedule it belongs to, as the joined read selects it. */
export interface ShiftWithSchedule extends Pick<
    ShiftsShiftEntity,
    "id" | "scheduleId" | "shiftDate" | "startTime" | "endTime" | "positionId" | "staffId" | "status"
> {
    /** Where the schedule of the shift stands. */
    readonly scheduleStatus: string
    /** The Monday of the schedule's week. */
    readonly weekStart: string
}

/** The id a Postgres function answers after it saved a row; null when it saved nothing. */
export interface SavedId {
    /** The id of the saved row, or null. */
    readonly id: string | null
}
