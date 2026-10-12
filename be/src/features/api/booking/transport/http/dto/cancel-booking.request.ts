import { IsUUID, MaxLength } from "class-validator"

/** The bounded HTTP params of cancel-booking. */
export class CancelBookingParamsRequest {
    /** The workspace id. */
    @IsUUID()
    @MaxLength(36)
    workspaceId!: string

    /** The id. */
    @IsUUID()
    @MaxLength(36)
    id!: string
}
