import { Field, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One usage tier of a plan: a monthly credit allowance and the price of it. */
export class BillingPlanTierType {
    /** The credits a month; per seat on a per-seat plan. */
    @Field(() => Float)
    creditsPerMonth!: number

    /** The price of a month in VND; per seat on a per-seat plan. */
    @Field(() => Float)
    priceVnd!: number

    /** The price is per seat. */
    @Field(() => Boolean)
    perSeat!: boolean
}
