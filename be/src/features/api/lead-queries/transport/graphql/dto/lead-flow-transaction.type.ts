import { Field, Float, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A payment transaction connected to the lead's invoices. */
export class LeadFlowTransactionType {
    /** The transaction id. */
    @Field(() => ID)
    id!: string

    /** The workspace that owns the transaction. */
    @Field(() => ID)
    workspaceId!: string

    /** The inbound event that recorded the payment. */
    @Field(() => ID, { nullable: true })
    inboundEventId!: string | null

    /** The payment channel: bank, cash, card or ewallet. */
    @Field()
    channel!: string

    /** The transaction amount in Vietnamese dong. */
    @Field(() => Float)
    amountVnd!: number

    /** The payment or bank reference. */
    @Field(() => String, { nullable: true })
    reference!: string | null

    /** The name or identity supplied by the payer. */
    @Field(() => String, { nullable: true })
    payer!: string | null

    /** When the payment occurred, in ISO 8601 format. */
    @Field()
    occurredAt!: string

    /** The invoice matched to this transaction. */
    @Field(() => ID, { nullable: true })
    invoiceId!: string | null

    /** The current matching or review status. */
    @Field()
    status!: string

    /** Whether the transaction originated from live or simulated input. */
    @Field()
    origin!: string

    /** When the transaction was recorded, in ISO 8601 format. */
    @Field()
    createdAt!: string
}
