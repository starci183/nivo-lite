import { Field, Float, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A payment row behind the governance figures. */
export class DashboardGovernanceTransactionType {
    /** The transaction id. */
    @Field(() => ID)
    id!: string

    /** The invoice it matched, or null. */
    @Field(() => ID, { nullable: true })
    invoiceId!: string | null

    /** Who paid, or null. */
    @Field(() => String, { nullable: true })
    payer!: string | null

    /** The payment reference, or null. */
    @Field(() => String, { nullable: true })
    reference!: string | null

    /** The amount in VND, or null. */
    @Field(() => Float, { nullable: true })
    amountVnd!: number | null

    /** The transaction status. */
    @Field()
    status!: string

    /** `live`, `simulated` or null. */
    @Field(() => String, { nullable: true })
    origin!: string | null
}
