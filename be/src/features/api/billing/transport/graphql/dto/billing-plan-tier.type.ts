import { Field, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A per-seat credit level (Team) or an add-on credit pack of a plan, with its own price. */
export class BillingPlanTierType {
    /** The credits: a month of one seat for a level, the credits a pack adds. */
    @Field(() => Float)
    creditsPerMonth!: number

    /** The price in VND: a month of one seat for a level, the pack's own price for a pack. */
    @Field(() => Float)
    priceVnd!: number

    /** The price is per seat. */
    @Field(() => Boolean)
    perSeat!: boolean
}
