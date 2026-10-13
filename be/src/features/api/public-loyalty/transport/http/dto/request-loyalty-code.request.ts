import { IsString, Matches, MaxLength } from "class-validator"

/** The bounded HTTP params of request-loyalty-code. */
export class RequestLoyaltyCodeParamsRequest {
    /** The slug. */
    @IsString()
    @Matches(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/)
    @MaxLength(40)
    slug!: string
}

/** The bounded HTTP body of request-loyalty-code. */
export class RequestLoyaltyCodeBodyRequest {
    /** The phone. */
    @IsString()
    @MaxLength(30)
    phone!: string
}
