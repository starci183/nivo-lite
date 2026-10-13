import { Field, InputType, ID } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength, MinLength } from "class-validator"

@InputType()
/** The bounded redeem loyalty reward arguments. */
export class RedeemLoyaltyRewardInput {
    /** The customer id. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    customerId!: string

    /** The reward id. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    rewardId!: string

    /** The token. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    token!: string
}
