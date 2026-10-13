import { Field, ObjectType } from "@nestjs/graphql"
import { LoyaltyEarnType } from "./loyalty-earn.type"
import { LoyaltyTierType } from "./loyalty-tier.type"
import { LoyaltyExpiryType } from "./loyalty-expiry.type"
import { LoyaltyBirthdayType } from "./loyalty-birthday.type"
import { LoyaltyPromoType } from "./loyalty-promo.type"

@ObjectType()
/** The loyalty config fields exposed through GraphQL. */
export class LoyaltyConfigType {
    /** The earn. */
    @Field(() => LoyaltyEarnType)
    earn!: LoyaltyEarnType

    /** The tiers. */
    @Field(() => [LoyaltyTierType])
    tiers!: ReadonlyArray<LoyaltyTierType>

    /** The expiry. */
    @Field(() => LoyaltyExpiryType)
    expiry!: LoyaltyExpiryType

    /** The birthday. */
    @Field(() => LoyaltyBirthdayType)
    birthday!: LoyaltyBirthdayType

    /** The promo. */
    @Field(() => LoyaltyPromoType)
    promo!: LoyaltyPromoType
}
