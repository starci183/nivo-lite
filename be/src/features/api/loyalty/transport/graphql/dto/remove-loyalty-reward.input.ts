import { Field, InputType, ID } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded remove loyalty reward arguments. */
export class RemoveLoyaltyRewardInput {
    /** The reward id. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    rewardId!: string
}
