import { Field, Float, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** An invoice in the lead's commercial flow. */
export class LeadFlowInvoiceType {
    /** The invoice id. */
    @Field(() => ID)
    id!: string

    /** The workspace that owns the invoice. */
    @Field(() => ID)
    workspaceId!: string

    /** The order billed by this invoice. */
    @Field(() => ID, { nullable: true })
    orderId!: string | null

    /** The lead connected to this invoice. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null

    /** The human-readable invoice number. */
    @Field()
    invoiceNo!: string

    /** The invoice amount in Vietnamese dong. */
    @Field(() => Float)
    amountVnd!: number

    /** When payment is due, in ISO 8601 format. */
    @Field(() => String, { nullable: true })
    dueAt!: string | null

    /** The invoice's current commercial status. */
    @Field()
    status!: string

    /** Whether the invoice originated from live or simulated input. */
    @Field()
    origin!: string

    /** The identity that issued the invoice. */
    @Field(() => ID, { nullable: true })
    issuedBy!: string | null

    /** When the invoice was issued, in ISO 8601 format. */
    @Field(() => String, { nullable: true })
    issuedAt!: string | null

    /** When the invoice was paid, in ISO 8601 format. */
    @Field(() => String, { nullable: true })
    paidAt!: string | null

    /** When the invoice was created, in ISO 8601 format. */
    @Field()
    createdAt!: string
}
