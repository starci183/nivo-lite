import { Field, Float, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The sales order record used by workspace workbenches. */
export class SalesOrderType {
    /** The order id. */
    @Field(() => ID)
    id!: string
    /** The workspace id. */
    @Field(() => ID)
    workspaceId!: string
    /** The linked lead id. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null
    /** The order number. */
    @Field()
    orderNo!: string
    /** The ordered items. */
    @Field()
    items!: string
    /** The known amount in VND. */
    @Field(() => Float, { nullable: true })
    amountVnd!: number | null
    /** The draft, confirmed, invoiced, paid or cancelled state. */
    @Field()
    status!: string
    /** Live or simulated origin. */
    @Field()
    origin!: string
    /** The person who confirmed the order. */
    @Field(() => String, { nullable: true })
    confirmedBy!: string | null
    /** The confirmation instant. */
    @Field(() => String, { nullable: true })
    confirmedAt!: string | null
    /** The creation instant. */
    @Field()
    createdAt!: string
    /** The shipment instant. */
    @Field(() => String, { nullable: true })
    shippedAt!: string | null
    /** The carrier name. */
    @Field(() => String, { nullable: true })
    carrier!: string | null
    /** The tracking reference. */
    @Field(() => String, { nullable: true })
    trackingCode!: string | null
}
