import { Field, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsString, Matches, Max, MaxLength, Min } from "class-validator"

@InputType()
/** The bounded loyalty promo arguments. */
export class LoyaltyPromoInput {
    /** The max per month. */
    @Field(() => Int)
    @IsInt()
    @Min(1)
    @Max(60)
    maxPerMonth!: number

    /** The hour from. */
    @Field(() => String)
    @IsString()
    @Matches(/^([01]\d|2[0-3]):[0-5]\d$/u)
    @MaxLength(5)
    hourFrom!: string

    /** The hour to. */
    @Field(() => String)
    @IsString()
    @Matches(/^([01]\d|2[0-3]):[0-5]\d$/u)
    @MaxLength(5)
    hourTo!: string

    /** The batch. */
    @Field(() => Int)
    @IsInt()
    @Min(1)
    @Max(200)
    batch!: number
}
