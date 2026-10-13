import { Field, Float, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The price of a plan selection for a workspace. */
export class BillingPlanQuoteType {
    /** The plan priced. */
    @Field(() => String)
    planCode!: string

    /** The cycle priced: monthly or annual. */
    @Field(() => String)
    cycle!: string

    /** Months the payment covers. */
    @Field(() => Int)
    months!: number

    /** The amount to transfer in VND. */
    @Field(() => Float)
    amountVnd!: number

    /** The full monthly price of the selection in VND, before the intro offer or the annual saving. */
    @Field(() => Float)
    listMonthlyVnd!: number

    /** The intro price applies to this payment. */
    @Field(() => Boolean)
    promo!: boolean

    /** The monthly allowance picked, or null for the plan's own. */
    @Field(() => Float, { nullable: true })
    tierCredits!: number | null

    /** The seats paid. */
    @Field(() => Int)
    seats!: number

    /** The credits a month the workspace gets, all seats together. */
    @Field(() => Float, { nullable: true })
    creditsPerMonth!: number | null
}
