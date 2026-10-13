import { Field, InputType, Int } from "@nestjs/graphql"
import { IsInt, Max, Min } from "class-validator"

@InputType()
/** The bounded loyalty expiry arguments. */
export class LoyaltyExpiryInput {
    /** The months. */
    @Field(() => Int)
    @IsInt()
    @Min(0)
    @Max(120)
    months!: number

    /** The warn days. */
    @Field(() => Int)
    @IsInt()
    @Min(1)
    @Max(180)
    warnDays!: number
}
