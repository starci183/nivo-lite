import { IsString, Matches, MaxLength } from "class-validator"

/** The bounded HTTP params of get-booking-page. */
export class GetBookingPageParamsRequest {
    /** The slug. */
    @IsString()
    @Matches(/^[a-z0-9][a-z0-9-]{2,40}$/)
    @MaxLength(41)
    slug!: string
}
