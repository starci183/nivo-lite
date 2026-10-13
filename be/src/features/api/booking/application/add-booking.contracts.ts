/** What add-booking takes. */
export interface AddBookingRequest {
    /** The workspace id. */
    readonly workspaceId: string
    /** The service id. */
    readonly serviceId: string
    /** The resource id. */
    readonly resourceId: string
    /** The date. */
    readonly date: string
    /** The time. */
    readonly time: string
    /** The party. */
    readonly party: number
    /** The name. */
    readonly name: string
    /** The phone. */
    readonly phone: string
    /** The note. */
    readonly note: string
    /** The force. */
    readonly force: boolean
}

/** What add-booking answers. */
export interface AddBookingResult {
    /** The ok. */
    readonly ok: boolean
    /** The reason. */
    readonly reason:
        | (
              | "service_required"
              | "name_required"
              | "datetime_invalid"
              | "service_not_found"
              | "closed"
              | "full"
              | "no_resource"
              | "taken"
              | "not_movable"
              | "resource_not_found"
          )
        | null
    /** The id. */
    readonly id: string | null
}
