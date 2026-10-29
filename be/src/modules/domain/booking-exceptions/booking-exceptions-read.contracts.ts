/** One calendar exception as other capabilities read it. */
export interface BookingExceptionRecord {
    /** The exception id. */
    readonly id: string
    /** The resource, or null for the whole shop. */
    readonly resourceId: string | null
    /** The local date, YYYY-MM-DD. */
    readonly onDate: string
    /** Whether the day is closed. */
    readonly closed: boolean
    /** The special opening time, or null. */
    readonly startTime: string | null
    /** The special closing time, or null. */
    readonly endTime: string | null
    /** The owner's note. */
    readonly note: string
}

/** The local date (YYYY-MM-DD) an exception list starts from, or none for every exception. */
export type OptionalFromDate = string | null
