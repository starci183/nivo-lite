import { Field, ObjectType, Float } from "@nestjs/graphql"

@ObjectType()
/** Accounting Credit returned by GraphQL. */
export class AccountingCreditType {
    /** id. */
    @Field(() => String)
    id!: string

    /** occurred At. */
    @Field(() => String)
    occurredAt!: string

    /** amount. */
    @Field(() => Float)
    amount!: number

    /** payer. */
    @Field(() => String, { nullable: true })
    payer!: string | null

    /** reference. */
    @Field(() => String, { nullable: true })
    reference!: string | null

    /** match. */
    @Field(() => String)
    match!: string

    /** invoice No. */
    @Field(() => String, { nullable: true })
    invoiceNo!: string | null

    /** source Kind. */
    @Field(() => String)
    sourceKind!: string
}
