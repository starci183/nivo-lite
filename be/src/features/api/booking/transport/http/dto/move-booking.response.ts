/** The HTTP answer of move-booking. */
export class MoveBookingResponse {
    /** The ok. */
    ok!: boolean

    /** The reason. */
    reason!:
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
    id!: string | null
}
