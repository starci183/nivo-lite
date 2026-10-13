import { Field, ObjectType, Float, Int } from "@nestjs/graphql"
import { BillingPlanFeaturesType } from "./billing-plan-features.type"

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
}
