import { Field, Float, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One customer of the inbox: every input of one person grouped into one row. */
export class InboxLeadRowType {
    /** The lead id; `key:<customer key>` or `event:<event id>` for a customer that is no lead yet. */
    @Field(() => ID)
    id!: string

    /** The name; empty when nobody gave one. */
    @Field()
    name!: string

    /** The channel key: zalo, telegram, facebook, instagram, website or bank. */
    @Field()
    channel!: string

    /** How the latest talk arrived on its channel: form, chat or message; null when unknown. */
    @Field(() => String, { nullable: true })
    via!: string | null

    /** Where the customer stands: new, consulting, ordered, paid or done. */
    @Field()
    stage!: string

    /** The marks of the row, most important first. */
    @Field(() => [String])
    chips!: ReadonlyArray<string>

    /** What the customer wants, in two lines at most. */
    @Field()
    summary!: string

    /** When the latest input arrived, ISO 8601. */
    @Field()
    lastAt!: string

    /** When the first input arrived, ISO 8601. */
    @Field()
    firstAt!: string

    /** Something waits for the owner. */
    @Field()
    needsOwner!: boolean

    /** The agent that owns the customer, or null. */
    @Field(() => ID, { nullable: true })
    agentId!: string | null

    /** The name of that agent, or null. */
    @Field(() => String, { nullable: true })
    agentName!: string | null

    /** The picture of that agent, or null. */
    @Field(() => String, { nullable: true })
    agentAvatarUrl!: string | null

    /** The value in VND; Float avoids the 32-bit integer limit of GraphQL. */
    @Field(() => Float, { nullable: true })
    amountVnd!: number | null

    /** How many inputs were grouped into the row. */
    @Field(() => Int)
    eventCount!: number

    /** The row is a bank credit no order has claimed. */
    @Field()
    isUnmatched!: boolean
}
