import { Field, Float, Int, ObjectType, ID } from "@nestjs/graphql"

@ObjectType()
/** Workspace billing state with the caller membership. */
export class BillingWorkspaceType {
    /** The workspace id. */
    @Field(() => ID)
    id!: string

    /** The workspace name. */
    @Field(() => String)
    name!: string

    /** The billing status. */
    @Field(() => String)
    status!: string

    /** The current plan code. */
    @Field(() => String, { nullable: true })
    planCode!: string | null

    /** End of paid period, ISO 8601. */
    @Field(() => String, { nullable: true })
    paidUntil!: string | null

    /** The monthly credit allowance picked from the usage tiers; null is the plan's own. */
    @Field(() => Float, { nullable: true })
    tierCredits!: number | null

    /** The paid seats of a per-seat plan. */
    @Field(() => Int, { nullable: true })
    seatCount!: number | null

    /** How the workspace pays: monthly or annual. */
    @Field(() => String, { nullable: true })
    billingCycle!: string | null

    /** The full monthly price of what the workspace bought in VND. */
    @Field(() => Float, { nullable: true })
    billedMonthlyVnd!: number | null

    /** The caller active membership role. */
    @Field(() => String)
    role!: string
}
