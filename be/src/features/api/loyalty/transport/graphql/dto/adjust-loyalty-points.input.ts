import { Field, InputType, ID, Int } from "@nestjs/graphql"
import { IsInt, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator"

@InputType()
/** The bounded adjust loyalty points arguments. */
export class AdjustLoyaltyPointsInput {
    /** The customer id. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    customerId!: string

    /** The points. */
    @Field(() => Int)
    @IsInt()
    @Min(-1000000000)
    @Max(1000000000)
    points!: number

    /** The reason. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(300)
    reason!: string

    /** The token. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    token!: string
}
