import { IsString, Matches, MaxLength } from "class-validator"

/** The bounded HTTP params of get-loyalty-page. */
export class GetLoyaltyPageParamsRequest {
    /** The slug. */
    @IsString()
    @Matches(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/)
    @MaxLength(40)
    slug!: string
}
