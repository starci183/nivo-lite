import { IsString, Matches, MaxLength, MinLength } from "class-validator"

/** The bounded HTTP request that orders the first payment of a plan. */
export class OrderPlanRequest {
    /** The plan to buy. */
    @IsString()
    @MinLength(1)
    @MaxLength(40)
    @Matches(/^[a-z0-9_-]+$/)
    planCode!: string
}
