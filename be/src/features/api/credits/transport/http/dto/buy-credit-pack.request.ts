import { IsString, Matches, MaxLength, MinLength } from "class-validator"

/** The bounded HTTP request that buys a credit pack. */
export class BuyCreditPackRequest {
    /** The pack to buy. */
    @IsString()
    @MinLength(1)
    @MaxLength(40)
    @Matches(/^[a-z0-9_-]+$/)
    packCode!: string
}
