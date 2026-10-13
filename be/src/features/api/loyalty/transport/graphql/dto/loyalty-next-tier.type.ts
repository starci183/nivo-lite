import { Field, ObjectType, Float } from "@nestjs/graphql"
import { LoyaltyTierType } from "./loyalty-tier.type"

@ObjectType()
/** The loyalty next tier fields exposed through GraphQL. */
export class LoyaltyNextTierType {
    /** The tier. */
    @Field(() => LoyaltyTierType)
    tier!: LoyaltyTierType

    /** The missing vnd. */
    @Field(() => Float)
    missingVnd!: number
}
