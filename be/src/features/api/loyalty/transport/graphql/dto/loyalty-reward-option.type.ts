import { Field, ObjectType } from "@nestjs/graphql"
import { LoyaltyRewardType } from "./loyalty-reward.type"
import { LoyaltyRedeemBlockType } from "./loyalty-redeem-block.type"

@ObjectType()
/** The loyalty reward option fields exposed through GraphQL. */
export class LoyaltyRewardOptionType {
    /** The reward. */
    @Field(() => LoyaltyRewardType)
    reward!: LoyaltyRewardType

    /** The block. */
    @Field(() => LoyaltyRedeemBlockType, { nullable: true })
    block!: LoyaltyRedeemBlockType | null
}
