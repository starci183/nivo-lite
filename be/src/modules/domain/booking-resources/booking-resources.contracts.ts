/** A resource or linked staff row selected within its workspace. */
export interface BookingResourceSaved {
    /** The row id. */
    readonly id: string
}

/** Validated resource fields written by the booking setup coordinator. */
export interface BookingResourceWrite {
    /** The owning workspace. */
    readonly workspaceId: string
    /** The existing resource id, or null for creation. */
    readonly id: string | null
    /** The resource name. */
    readonly name: string
    /** The resource kind. */
    readonly kind: string
    /** The number of simultaneous visits it supports. */
    readonly capacity: number
    /** Whether new visits may use it. */
    readonly active: boolean
    /** The linked staff member, or null. */
    readonly staffId: string | null
}
