/** The HTTP answer of add-booking. */
export class AddBookingResponse {
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
