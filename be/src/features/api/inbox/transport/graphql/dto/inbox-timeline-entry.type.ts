import { Field, Float, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One entry of the journey of a customer across channels. */
export class InboxTimelineEntryType {
    /** The entry id. */
    @Field(() => ID)
    id!: string

    /** message, agent, order, payment or decision. */
    @Field()
    kind!: string

    /** When, ISO 8601. */
    @Field()
    at!: string

    /** The channel key the entry belongs to, or null. */
    @Field(() => String, { nullable: true })
    channel!: string | null

    /** The text; for an agent entry the action key, for an order its number. */
    @Field()
    text!: string

    /** The status of the thing the entry is about, or null. */
    @Field(() => String, { nullable: true })
    status!: string | null

    /** The value in VND, or null. */
    @Field(() => Float, { nullable: true })
    amountVnd!: number | null
}
