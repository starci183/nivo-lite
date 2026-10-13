import { Field, Float, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One invoice a payment may settle, with the customer, the order and both statuses. */
export class ReconcileCandidateType {
    /** The invoice id. */
    @Field(() => ID)
    id!: string

    /** The invoice number. */
    @Field()
    invoice_no!: string

    /** The amount, VND. */
    @Field(() => Float)
    amount_vnd!: number

    /** The invoice status. */
    @Field()
    status!: string

    /** The customer's name. */
    @Field(() => String, { nullable: true })
    customer!: string | null

    /** The customer's company. */
    @Field(() => String, { nullable: true })
    company!: string | null

    /** The order number. */
    @Field(() => String, { nullable: true })
    order_no!: string | null

    /** What the order contains. */
    @Field(() => String, { nullable: true })
    order_items!: string | null

    /** The order status. */
    @Field(() => String, { nullable: true })
    order_status!: string | null

    /** When the invoice was issued, ISO 8601. */
    @Field(() => String, { nullable: true })
    issued_at!: string | null

    /** When the invoice is due, ISO 8601. */
    @Field(() => String, { nullable: true })
    due_at!: string | null
}
