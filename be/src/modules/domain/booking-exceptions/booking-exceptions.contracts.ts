/** A closing or special opening on a calendar date. */
export interface BookingExceptionCreateParams {
    /** The workspace that owns the exception. */
    readonly workspaceId: string
    /** The affected resource, or null for every resource in the workspace. */
    readonly resourceId: string | null
    /** The calendar date in YYYY-MM-DD form. */
    readonly date: string
    /** Whether the resource is closed for the entire date. */
    readonly closed: boolean
    /** The special opening time, or null for a closure. */
    readonly start: string | null
    /** The special closing time, or null for a closure. */
    readonly end: string | null
    /** The operator's note. */
    readonly note: string
}

/** The identity returned by an exception write. */
export interface BookingExceptionSaved {
    /** The exception identity. */
    readonly id: string
}
