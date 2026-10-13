import { Field, ObjectType, ID, Float } from "@nestjs/graphql"

@ObjectType()
/** The loyalty ledger fields exposed through GraphQL. */
export class LoyaltyLedgerType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The customer id. */
    @Field(() => ID)
    customerId!: string

    /** The kind. */
    @Field(() => String)
    kind!: string

    /** The points. */
    @Field(() => Float)
    points!: number

    /** The amount vnd. */
    @Field(() => Float, { nullable: true })
    amountVnd!: number | null

    /** The order id. */
    @Field(() => ID, { nullable: true })
    orderId!: string | null

    /** The ref. */
    @Field(() => String)
    ref!: string

    /** The by. */
    @Field(() => String)
    by!: string

    /** The evidence. */
    @Field(() => String, { nullable: true })
    evidence!: string | null

    /** The reward id. */
    @Field(() => ID, { nullable: true })
    rewardId!: string | null

    /** The work item id. */
    @Field(() => ID, { nullable: true })
    workItemId!: string | null

    /** The expires at. */
    @Field(() => String, { nullable: true })
    expiresAt!: string | null

    /** The occurred at. */
    @Field(() => String)
    occurredAt!: string
}
