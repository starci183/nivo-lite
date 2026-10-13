import { Field, Float, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** An invoice row behind the governance figures. */
export class DashboardGovernanceInvoiceType {
    /** The invoice id. */
    @Field(() => ID)
    id!: string

    /** The order, or null. */
    @Field(() => ID, { nullable: true })
    orderId!: string | null

    /** The lead, or null. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null

    /** The invoice number, or null. */
    @Field(() => String, { nullable: true })
    invoiceNo!: string | null

    /** The amount in VND, or null. */
    @Field(() => Float, { nullable: true })
    amountVnd!: number | null

    /** The invoice status. */
    @Field()
    status!: string

    /** `live`, `simulated` or null. */
    @Field(() => String, { nullable: true })
    origin!: string | null
}
