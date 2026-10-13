import { Field, Float, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One received input in the selected workspace's inbox. */
export class InboundEventType {
    /** The stored input id. */
    @Field(() => ID)
    id!: string

    /** The channel that delivered the input. */
    @Field()
    channel!: string

    /** The input kind. */
    @Field()
    kind!: string

    /** Whether the input is live or simulated. */
    @Field()
    origin!: string

    /** The sender's display name. */
    @Field(() => String, { nullable: true })
    senderName!: string | null

    /** The sender's contact information. */
    @Field(() => String, { nullable: true })
    senderContact!: string | null

    /** The text of the input. */
    @Field()
    body!: string

    /** The amount in VND; Float avoids GraphQL's 32-bit integer limit. */
    @Field(() => Float, { nullable: true })
    amountVnd!: number | null

    /** The external order or transfer reference. */
    @Field(() => String, { nullable: true })
    externalRef!: string | null

    /** The channel's event identity used for deduplication. */
    @Field(() => String, { nullable: true })
    eventId!: string | null

    /** How many repeated deliveries were blocked. */
    @Field(() => Int)
    duplicateCount!: number

    /** The lead linked by the processing workflow. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null

    /** Where processing stands. */
    @Field()
    status!: string

    /** When the input arrived, as ISO 8601 text. */
    @Field()
    createdAt!: string
}
