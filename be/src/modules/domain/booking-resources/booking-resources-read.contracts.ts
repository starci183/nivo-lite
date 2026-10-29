/** A resource as other capabilities read it. */
export interface BookingResourceRecord {
    /** The resource id. */
    readonly id: string
    /** The name. */
    readonly name: string
    /** The kind. */
    readonly kind: string
    /** How many customers it holds at once. */
    readonly capacity: number
    /** The display colour. */
    readonly color: string
    /** Whether it takes bookings. */
    readonly active: boolean
    /** The linked staff member, or null. */
    readonly staffId: string | null
    /** The owner's order. */
    readonly sortOrder: number
}

/** A resource that is linked to a staff member. */
export interface BookingResourceStaffLink {
    /** The resource id. */
    readonly id: string
    /** The staff member. */
    readonly staffId: string | null
}

/** How many customers a locked resource holds. */
export interface BookingResourceCapacity {
    /** The capacity. */
    readonly capacity: number
}

/** The capacity of a locked resource, or null when it is not in the workspace. */
export type OptionalBookingResourceCapacity = BookingResourceCapacity | null
