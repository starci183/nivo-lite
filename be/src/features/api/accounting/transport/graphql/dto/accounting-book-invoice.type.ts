import { Field, ObjectType, Float } from "@nestjs/graphql"
import { AccountingBookOrderBriefType } from "./accounting-book-order-brief.type"
import { AccountingBookLeadType } from "./accounting-book-lead.type"

@ObjectType()
/** Accounting Book Invoice returned by GraphQL. */
export class AccountingBookInvoiceType {
    /** id. */
    @Field(() => String)
    id!: string

    /** workspace Id. */
    @Field(() => String)
    workspaceId!: string

    /** order Id. */
    @Field(() => String, { nullable: true })
    orderId!: string | null

    /** lead Id. */
    @Field(() => String, { nullable: true })
    leadId!: string | null

    /** invoice No. */
    @Field(() => String)
    invoiceNo!: string

    /** amount Vnd. */
    @Field(() => Float)
    amountVnd!: number

    /** status. */
    @Field(() => String)
    status!: string

    /** origin. */
    @Field(() => String)
    origin!: string

    /** issued By. */
    @Field(() => String, { nullable: true })
    issuedBy!: string | null

    /** paid At. */
    @Field(() => String, { nullable: true })
    paidAt!: string | null

    /** issued At. */
    @Field(() => String, { nullable: true })
    issuedAt!: string | null

    /** due At. */
    @Field(() => String, { nullable: true })
    dueAt!: string | null

    /** created At. */
    @Field(() => String)
    createdAt!: string

    /** order. */
    @Field(() => AccountingBookOrderBriefType, { nullable: true })
    order!: AccountingBookOrderBriefType | null

    /** lead. */
    @Field(() => AccountingBookLeadType, { nullable: true })
    lead!: AccountingBookLeadType | null
}
