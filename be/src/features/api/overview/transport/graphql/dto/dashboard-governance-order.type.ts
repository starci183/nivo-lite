import { Field, Float, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** An order row behind the governance figures. */
export class DashboardGovernanceOrderType {
    /** The order id. */
    @Field(() => ID)
    id!: string

    /** The lead, or null. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null

    /** The order number, or null. */
    @Field(() => String, { nullable: true })
    orderNo!: string | null

    /** The item text, or null. */
    @Field(() => String, { nullable: true })
    items!: string | null

    /** The amount in VND, or null. */
    @Field(() => Float, { nullable: true })
    amountVnd!: number | null

    /** The order status. */
    @Field()
    status!: string

    /** `live`, `simulated` or null. */
    @Field(() => String, { nullable: true })
    origin!: string | null
}
