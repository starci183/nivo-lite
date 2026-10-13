import { Field, ObjectType, Float, Int } from "@nestjs/graphql"
import { BillingPlanFeaturesType } from "./billing-plan-features.type"
import { BillingPlanTierType } from "./billing-plan-tier.type"

@ObjectType()
/** An active plan in the billing catalogue. */
export class BillingPlanType {
    /** The plan code. */
    @Field(() => String)
    code!: string

    /** The Vietnamese name. */
    @Field(() => String)
    nameVi!: string

    /** The English name. */
    @Field(() => String)
    nameEn!: string

    /** The period price in VND. */
    @Field(() => Float)
    priceVnd!: number

    /** The month or year billing period. */
    @Field(() => String)
    period!: string

    /** Included seats. */
    @Field(() => Int)
    seats!: number

    /** Localized features. */
    @Field(() => BillingPlanFeaturesType)
    features!: BillingPlanFeaturesType

    /** Display order. */
    @Field(() => Int)
    sort!: number

    /** Monthly AI credits; null is unlimited. */
    @Field(() => Float, { nullable: true })
    aiCreditsPerMonth!: number | null

    /** Whether a contract is required. */
    @Field(() => Boolean)
    isCustom!: boolean

    /** The price of a year paid at once in VND; null when the plan has no annual price. */
    @Field(() => Float, { nullable: true })
    priceAnnualVnd!: number | null

    /** The share saved by paying a year at once, in percent. */
    @Field(() => Int, { nullable: true })
    annualDiscountPct!: number | null

    /** The monthly price of the intro months in VND. */
    @Field(() => Float, { nullable: true })
    promoPriceVnd!: number | null

    /** How many paid months the intro price lasts. */
    @Field(() => Int, { nullable: true })
    promoMonths!: number | null

    /** The storage the plan includes in GB; null is not capped. */
    @Field(() => Int, { nullable: true })
    storageGb!: number | null

    /** One person only: no other members can be invited. */
    @Field(() => Boolean)
    individual!: boolean

    /** The price is per seat. */
    @Field(() => Boolean)
    perSeat!: boolean

    /** On sale to new customers. */
    @Field(() => Boolean)
    listed!: boolean

    /** The usage tiers the plan can be bought with, smallest first. */
    @Field(() => [BillingPlanTierType])
    tiers!: ReadonlyArray<BillingPlanTierType>
}
