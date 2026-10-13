import { Field, InputType, Int } from "@nestjs/graphql"
import { IsBoolean, IsInt, IsString, Max, MaxLength, Min } from "class-validator"

@InputType()
/** The bounded loyalty birthday arguments. */
export class LoyaltyBirthdayInput {
    /** The enabled. */
    @Field(() => Boolean)
    @IsBoolean()
    enabled!: boolean

    /** The points. */
    @Field(() => Int)
    @IsInt()
    @Min(0)
    @Max(1e6)
    points!: number

    /** The reward key. */
    @Field(() => String)
    @IsString()
    @MaxLength(40)
    rewardKey!: string

    /** The note. */
    @Field(() => String)
    @IsString()
    @MaxLength(200)
    note!: string
}
