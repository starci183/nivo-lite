import { Field, ObjectType, Float } from "@nestjs/graphql"
import { AccountingBookLeadType } from "./accounting-book-lead.type"

@ObjectType()
/** Accounting Book Order returned by GraphQL. */
export class AccountingBookOrderType {
    /** id. */
    @Field(() => String)
    id!: string

    /** workspace Id. */
    @Field(() => String)
    workspaceId!: string

    /** lead Id. */
    @Field(() => String, { nullable: true })
    leadId!: string | null

    /** inbound Event Id. */
    @Field(() => String, { nullable: true })
    inboundEventId!: string | null

    /** order No. */
    @Field(() => String)
    orderNo!: string

    /** items. */
    @Field(() => String)
    items!: string

    /** amount Vnd. */
    @Field(() => Float, { nullable: true })
    amountVnd!: number | null

    /** status. */
    @Field(() => String)
    status!: string

    /** confirmed By. */
    @Field(() => String, { nullable: true })
    confirmedBy!: string | null

    /** confirmed At. */
    @Field(() => String, { nullable: true })
    confirmedAt!: string | null

    /** created At. */
    @Field(() => String)
    createdAt!: string

    /** shipped At. */
    @Field(() => String, { nullable: true })
    shippedAt!: string | null

    /** carrier. */
    @Field(() => String, { nullable: true })
    carrier!: string | null

    /** tracking Code. */
    @Field(() => String, { nullable: true })
    trackingCode!: string | null

    /** lead. */
    @Field(() => AccountingBookLeadType, { nullable: true })
    lead!: AccountingBookLeadType | null
}
