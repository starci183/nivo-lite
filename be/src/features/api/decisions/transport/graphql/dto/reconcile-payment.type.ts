import { Field, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The bank credit, or the customer's claim, behind a waiting reconciliation. */
export class ReconcilePaymentType {
    /** The money, VND. */
    @Field(() => Float, { nullable: true })
    amount_vnd!: number | null

    /** Who paid, or who said they paid. */
    @Field(() => String, { nullable: true })
    payer!: string | null

    /** The transfer content, or the claim. */
    @Field(() => String, { nullable: true })
    reference!: string | null

    /** When it happened, ISO 8601. */
    @Field(() => String, { nullable: true })
    occurred_at!: string | null
}
