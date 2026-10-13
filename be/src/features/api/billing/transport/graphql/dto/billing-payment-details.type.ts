import { Field, ObjectType, Float, Int } from "@nestjs/graphql"

@ObjectType()
/** Figures frozen when a top-up or upgrade order was created. */
export class BillingPaymentDetailsType {
    /** Credits bought. */
    @Field(() => Float, { nullable: true })
    credits!: number | null

    /** The original plan. */
    @Field(() => String, { nullable: true })
    from!: string | null

    /** The target plan. */
    @Field(() => String, { nullable: true })
    to!: string | null

    /** The original plan price. */
    @Field(() => Float, { nullable: true })
    fromPrice!: number | null

    /** The target plan price. */
    @Field(() => Float, { nullable: true })
    toPrice!: number | null

    /** Unused value deducted in VND. */
    @Field(() => Float, { nullable: true })
    credit!: number | null

    /** Days remaining in the paid period. */
    @Field(() => Int, { nullable: true })
    daysLeft!: number | null

    /** The unchanged end of paid period. */
    @Field(() => String, { nullable: true })
    paidUntil!: string | null
}
