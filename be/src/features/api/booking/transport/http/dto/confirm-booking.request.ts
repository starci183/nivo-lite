import { IsUUID, MaxLength } from "class-validator"

/** The bounded HTTP params of confirm-booking. */
export class ConfirmBookingParamsRequest {
    /** The workspace id. */
    @IsUUID()
    @MaxLength(36)
    workspaceId!: string

    /** The id. */
    @IsUUID()
    @MaxLength(36)
    id!: string
}
