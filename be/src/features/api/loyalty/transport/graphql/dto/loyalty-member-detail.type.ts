import { Field, ObjectType } from "@nestjs/graphql"
import { LoyaltyMemberType } from "./loyalty-member.type"
import { LoyaltyLedgerType } from "./loyalty-ledger.type"
import { LoyaltyNextTierType } from "./loyalty-next-tier.type"
import { LoyaltyExpiringType } from "./loyalty-expiring.type"
import { LoyaltyRewardOptionType } from "./loyalty-reward-option.type"

@ObjectType()
/** The loyalty member detail fields exposed through GraphQL. */
export class LoyaltyMemberDetailType {
    /** The member. */
    @Field(() => LoyaltyMemberType)
    member!: LoyaltyMemberType

    /** The ledger. */
    @Field(() => [LoyaltyLedgerType])
    ledger!: ReadonlyArray<LoyaltyLedgerType>

    /** The tier name. */
    @Field(() => String)
    tierName!: string

    /** The next tier. */
    @Field(() => LoyaltyNextTierType, { nullable: true })
    nextTier!: LoyaltyNextTierType | null

    /** The expiring. */
    @Field(() => LoyaltyExpiringType)
    expiring!: LoyaltyExpiringType

    /** The rewards. */
    @Field(() => [LoyaltyRewardOptionType])
    rewards!: ReadonlyArray<LoyaltyRewardOptionType>
}
