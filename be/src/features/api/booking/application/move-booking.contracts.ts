/** What move-booking takes. */
export interface MoveBookingRequest {
    /** The workspace id. */
    readonly workspaceId: string
    /** The id. */
    readonly id: string
    /** The start at. */
    readonly startAt: string
    /** The resource id. */
    readonly resourceId: string
    /** The force. */
    readonly force: boolean
}

/** What move-booking answers. */
export interface MoveBookingResult {
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
