import { Field, ObjectType, Float } from "@nestjs/graphql"

@ObjectType()
/** Accounting Invoice returned by GraphQL. */
export class AccountingInvoiceType {
    /** id. */
    @Field(() => String)
    id!: string

    /** invoice No. */
    @Field(() => String)
    invoiceNo!: string

    /** amount. */
    @Field(() => Float)
    amount!: number

    /** status. */
    @Field(() => String)
    status!: string

    /** customer. */
    @Field(() => String, { nullable: true })
    customer!: string | null

    /** issued At. */
    @Field(() => String, { nullable: true })
    issuedAt!: string | null

    /** paid At. */
    @Field(() => String, { nullable: true })
    paidAt!: string | null

    /** due At. */
    @Field(() => String, { nullable: true })
    dueAt!: string | null

    /** created At. */
    @Field(() => String)
    createdAt!: string

    /** order No. */
    @Field(() => String, { nullable: true })
    orderNo!: string | null
}
