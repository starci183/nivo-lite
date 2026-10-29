/** A shift together with the state of the schedule it belongs to, as the joined read selects it. */
export interface ShiftWithSchedule {
    /** The shift id. */
    readonly id: string
    /** The schedule it belongs to. */
    readonly scheduleId: string
    /** The day, as `YYYY-MM-DD`. */
    readonly shiftDate: string
    /** The start time. */
    readonly startTime: string
    /** The end time. */
    readonly endTime: string
    /** The position it fills. */
    readonly positionId: string
    /** The person on it, or null while it is open. */
    readonly staffId: string | null
    /** Where the shift stands (draft, published, swapped, cancelled). */
    readonly status: string
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
