import { Field, ObjectType, Float } from "@nestjs/graphql"
import { PublicLoyaltyTierType } from "./public-loyalty-tier.type"

@ObjectType()
/** The next tier and remaining qualifying spend. */
export class PublicLoyaltyNextTierType {
    /** The next tier. */
    @Field(() => PublicLoyaltyTierType)
    tier!: PublicLoyaltyTierType

    /** The remaining qualifying spend in VND. */
    @Field(() => Float)
    missingVnd!: number
}
