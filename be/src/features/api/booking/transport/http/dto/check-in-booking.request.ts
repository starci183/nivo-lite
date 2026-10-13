import { IsUUID, MaxLength } from "class-validator"

/** The bounded HTTP params of check-in-booking. */
export class CheckInBookingParamsRequest {
    /** The workspace id. */
    @IsUUID()
    @MaxLength(36)
    workspaceId!: string

    /** The id. */
    @IsUUID()
    @MaxLength(36)
    id!: string
}
