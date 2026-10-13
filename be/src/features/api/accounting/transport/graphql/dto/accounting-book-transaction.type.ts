import { Field, ObjectType, Float } from "@nestjs/graphql"
import { AccountingBookInboundType } from "./accounting-book-inbound.type"

@ObjectType()
/** Accounting Book Transaction returned by GraphQL. */
export class AccountingBookTransactionType {
    /** id. */
    @Field(() => String)
    id!: string

    /** workspace Id. */
    @Field(() => String)
    workspaceId!: string

    /** inbound Event Id. */
    @Field(() => String, { nullable: true })
    inboundEventId!: string | null

    /** amount Vnd. */
    @Field(() => Float)
    amountVnd!: number

    /** reference. */
    @Field(() => String, { nullable: true })
    reference!: string | null

    /** payer. */
    @Field(() => String, { nullable: true })
    payer!: string | null

    /** invoice Id. */
    @Field(() => String, { nullable: true })
    invoiceId!: string | null

    /** status. */
    @Field(() => String)
    status!: string

    /** origin. */
    @Field(() => String)
    origin!: string

    /** channel. */
    @Field(() => String)
    channel!: string

    /** occurred At. */
    @Field(() => String)
    occurredAt!: string

    /** created At. */
    @Field(() => String)
    createdAt!: string

    /** inbound. */
    @Field(() => AccountingBookInboundType, { nullable: true })
    inbound!: AccountingBookInboundType | null
}
