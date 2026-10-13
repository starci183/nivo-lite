import { IsUUID, MaxLength } from "class-validator"

/** The bounded HTTP params of complete-booking. */
export class CompleteBookingParamsRequest {
    /** The workspace id. */
    @IsUUID()
    @MaxLength(36)
    workspaceId!: string

    /** The id. */
    @IsUUID()
    @MaxLength(36)
    id!: string
}
