import { IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator"

/** The bounded HTTP params of get-booking-overview. */
export class GetBookingOverviewParamsRequest {
    /** The workspace id. */
    @IsUUID()
    @MaxLength(36)
    workspaceId!: string
}

/** The bounded HTTP query of get-booking-overview. */
export class GetBookingOverviewSearchRequest {
    /** The from. */
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    @MaxLength(10)
    from!: string

    /** The to. */
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    @MaxLength(10)
    to!: string

    /** The installation id. */
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    installationId?: string
}
