import { IsISO8601, IsInt, IsString, IsUUID, Matches, Max, MaxLength, Min } from "class-validator"

/** The bounded HTTP params of request-booking. */
export class RequestBookingParamsRequest {
    /** The slug. */
    @IsString()
    @Matches(/^[a-z0-9][a-z0-9-]{2,40}$/)
    @MaxLength(41)
    slug!: string
}

/** The bounded HTTP body of request-booking. */
export class RequestBookingBodyRequest {
    /** The service id. */
    @IsUUID()
    @MaxLength(36)
    serviceId!: string

    /** The start. */
    @IsISO8601({ strict: true })
    @MaxLength(40)
    start!: string

    /** The name. */
    @IsString()
    @MaxLength(120)
    name!: string

    /** The phone. */
    @IsString()
    @MaxLength(40)
    phone!: string

    /** The email. */
    @IsString()
    @MaxLength(120)
    email!: string

    /** The party. */
    @IsInt()
    @Min(1)
    @Max(20)
    party!: number

    /** The note. */
    @IsString()
    @MaxLength(400)
    note!: string

    /** The token. */
    @IsString()
    @MaxLength(64)
    token!: string

    /** The website. */
    @IsString()
    @MaxLength(200)
    website!: string
}
