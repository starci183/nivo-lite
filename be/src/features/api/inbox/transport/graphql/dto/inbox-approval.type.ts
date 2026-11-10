import { Field, Float, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What waits for the owner on one customer. */
export class InboxApprovalType {
    /** The draft order to approve; null when what waits is no order. */
    @Field(() => ID, { nullable: true })
    orderId!: string | null

    /** The number of the draft order, or null. */
    @Field(() => String, { nullable: true })
    orderNo!: string | null

    /** The value in VND, or null. */
    @Field(() => Float, { nullable: true })
    amountVnd!: number | null

    /** What the order holds, in words. */
    @Field(() => String, { nullable: true })
    itemsText!: string | null

    /** The agent that asked, or null. */
    @Field(() => String, { nullable: true })
    agentName!: string | null
}
