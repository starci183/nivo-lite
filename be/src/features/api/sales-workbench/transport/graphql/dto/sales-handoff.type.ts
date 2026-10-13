import { Field, ObjectType, ID, Float } from "@nestjs/graphql"
import { SalesHandoffInvoiceType } from "./sales-handoff-invoice.type"
import { SalesHandoffWorkType } from "./sales-handoff-work.type"

@ObjectType()
/** One Sales order or won customer with its Accounting and shipping state. */
export class SalesHandoffType {
    /** The key. */
    @Field(() => String)
    key!: string

    /** The order id. */
    @Field(() => ID, { nullable: true })
    orderId!: string | null

    /** The lead id. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null

    /** The customer. */
    @Field(() => String)
    customer!: string

    /** The order no. */
    @Field(() => String, { nullable: true })
    orderNo!: string | null

    /** The items. */
    @Field(() => String)
    items!: string

    /** The amount vnd. */
    @Field(() => Float, { nullable: true })
    amountVnd!: number | null

    /** The order status. */
    @Field(() => String)
    orderStatus!: string

    /** The confirmed at. */
    @Field(() => String, { nullable: true })
    confirmedAt!: string | null

    /** The invoice. */
    @Field(() => SalesHandoffInvoiceType, { nullable: true })
    invoice!: SalesHandoffInvoiceType | null

    /** The work. */
    @Field(() => SalesHandoffWorkType, { nullable: true })
    work!: SalesHandoffWorkType | null

    /** The can handoff. */
    @Field(() => Boolean)
    canHandoff!: boolean

    /** The shipped at. */
    @Field(() => String, { nullable: true })
    shippedAt!: string | null

    /** The carrier. */
    @Field(() => String, { nullable: true })
    carrier!: string | null

    /** The tracking code. */
    @Field(() => String, { nullable: true })
    trackingCode!: string | null

    /** The can ship. */
    @Field(() => Boolean)
    canShip!: boolean
}
