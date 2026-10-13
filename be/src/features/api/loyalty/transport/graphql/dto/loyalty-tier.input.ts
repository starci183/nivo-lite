import { Field, InputType, Float, Int } from "@nestjs/graphql"
import { IsInt, IsNumber, IsString, Max, MaxLength, Min } from "class-validator"

@InputType()
/** The bounded loyalty tier arguments. */
export class LoyaltyTierInput {
    /** The key. */
    @Field(() => String)
    @IsString()
    @MaxLength(24)
    key!: string

    /** The name. */
    @Field(() => String)
    @IsString()
    @MaxLength(30)
    name!: string

    /** The min spend vnd. */
    @Field(() => Float)
    @IsNumber()
    @Min(0)
    @Max(1e12)
    minSpendVnd!: number

    /** The multiplier. */
    @Field(() => Float)
    @IsNumber()
    @Min(1)
    @Max(10)
    multiplier!: number

    /** The winback days. */
    @Field(() => Int)
    @IsInt()
    @Min(7)
    @Max(365)
    winbackDays!: number

    /** The benefit. */
    @Field(() => String)
    @IsString()
    @MaxLength(200)
    benefit!: string
}
