import { IsString, Matches, MaxLength } from "class-validator"

/** The bounded HTTP params of verify-loyalty-code. */
export class VerifyLoyaltyCodeParamsRequest {
    /** The slug. */
    @IsString()
    @Matches(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/)
    @MaxLength(40)
    slug!: string
}

/** The bounded HTTP body of verify-loyalty-code. */
export class VerifyLoyaltyCodeBodyRequest {
    /** The phone. */
    @IsString()
    @MaxLength(30)
    phone!: string

    /** The typed. */
    @IsString()
    @MaxLength(20)
    typed!: string
}
