/** Input for save-booking-hours. */
export interface SaveBookingHoursRequest {
    /** The workspace that owns these booking settings. */
    readonly workspaceId: string
    /** The resource whose opening hours are replaced. */
    readonly resourceId: string
    /** The complete weekly opening-hours schedule. */
    readonly rows: ReadonlyArray<SaveBookingHoursRowRequest>
}

/** Resource whose weekly availability was replaced successfully. */
export interface SaveBookingHoursResult {
    /** Use this value to refresh availability for the affected resource. */
    readonly id: string
}

/** One opening-hours interval in a weekly schedule. */
export interface SaveBookingHoursRowRequest {
    /** The ISO weekday from Monday (1) through Sunday (7). */
    readonly weekday: number
    /** The opening time in local HH:mm format. */
    readonly start: string
    /** The closing time in local HH:mm format. */
    readonly end: string
}
