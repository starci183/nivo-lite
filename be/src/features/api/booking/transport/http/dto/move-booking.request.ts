import { IsBoolean, IsISO8601, IsUUID, MaxLength } from "class-validator"

/** The bounded HTTP params of move-booking. */
export class MoveBookingParamsRequest {
    /** The workspace id. */
    @IsUUID()
    @MaxLength(36)
    workspaceId!: string

    /** The id. */
    @IsUUID()
    @MaxLength(36)
    id!: string
}

/** The bounded HTTP body of move-booking. */
export class MoveBookingBodyRequest {
    /** The start at. */
    @IsISO8601({ strict: true })
    @MaxLength(40)
    startAt!: string

    /** The resource id. */
    @IsUUID()
    @MaxLength(36)
    resourceId!: string

    /** The force. */
    @IsBoolean()
    force!: boolean
}
