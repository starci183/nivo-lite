import { IsBoolean, IsInt, IsString, IsUUID, Max, MaxLength, Min } from "class-validator"

/** The bounded HTTP params of add-booking. */
export class AddBookingParamsRequest {
    /** The workspace id. */
    @IsUUID()
    @MaxLength(36)
    workspaceId!: string
}

/** The bounded HTTP body of add-booking. */
export class AddBookingBodyRequest {
    /** The service id. */
    @IsString()
    @MaxLength(36)
    serviceId!: string

    /** The resource id. */
    @IsString()
    @MaxLength(36)
    resourceId!: string

    /** The date. */
    @IsString()
    @MaxLength(10)
    date!: string

    /** The time. */
    @IsString()
    @MaxLength(5)
    time!: string

    /** The party. */
    @IsInt()
    @Min(1)
    @Max(200)
    party!: number

    /** The name. */
    @IsString()
    @MaxLength(120)
    name!: string

    /** The phone. */
    @IsString()
    @MaxLength(40)
    phone!: string

    /** The note. */
    @IsString()
    @MaxLength(400)
    note!: string

    /** The force. */
    @IsBoolean()
    force!: boolean
}
