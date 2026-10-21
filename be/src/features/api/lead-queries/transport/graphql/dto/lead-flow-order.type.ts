import { Field, Float, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A sales order in the lead's commercial flow. */
export class LeadFlowOrderType {
    /** The order id. */
    @Field(() => ID)
    id!: string

    /** The workspace that owns the order. */
    @Field(() => ID)
    workspaceId!: string

    /** The lead connected to the order. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null

    /** The inbound event that created the order. */
    @Field(() => ID, { nullable: true })
    inboundEventId!: string | null

    /** The human-readable order number. */
    @Field()
    orderNo!: string

    /** The order's item description. */
    @Field()
    items!: string

    /** The order amount in Vietnamese dong. */
    @Field(() => Float, { nullable: true })
    amountVnd!: number | null

    /** The order's current commercial status. */
    @Field()
    status!: string

    /** The identity that confirmed the order. */
    @Field(() => ID, { nullable: true })
    confirmedBy!: string | null

    /** When the order was confirmed, in ISO 8601 format. */
    @Field(() => String, { nullable: true })
    confirmedAt!: string | null

    /** When the order was created, in ISO 8601 format. */
    @Field()
    createdAt!: string

    /** When the order was marked shipped, in ISO 8601 format. */
    @Field(() => String, { nullable: true })
    shippedAt!: string | null

    /** The carrier responsible for delivering the order. */
    @Field(() => String, { nullable: true })
    carrier!: string | null

    /** The shipment tracking code. */
    @Field(() => String, { nullable: true })
    trackingCode!: string | null
}
