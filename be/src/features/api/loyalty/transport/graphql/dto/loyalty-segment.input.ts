import { Field, InputType, Int, Float } from "@nestjs/graphql"
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsNumber, IsString, Max, MaxLength, Min } from "class-validator"

@InputType()
/** The bounded loyalty segment arguments. */
export class LoyaltySegmentInput {
    /** The tiers. */
    @Field(() => [String])
    @IsArray()
    @ArrayMaxSize(8)
    @IsString({ each: true })
    @MaxLength(24, { each: true })
    tiers!: ReadonlyArray<string>

    /** The inactive days. */
    @Field(() => Int)
    @IsInt()
    @Min(0)
    @Max(3650)
    inactiveDays!: number

    /** The birthday this month. */
    @Field(() => Boolean)
    @IsBoolean()
    birthdayThisMonth!: boolean

    /** The min spend vnd. */
    @Field(() => Float)
    @IsNumber()
    @Min(0)
    @Max(1e12)
    minSpendVnd!: number
}
