import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Where a truth or a change request comes from. */
export class BrainGraphOriginType {
    /** `document`, `chat`, `manual` or `other`. */
    @Field(() => String)
    kind!: string

    /** The document title, or the label of the evidence ("Private chat with an agent", "Common chat"). */
    @Field(() => String)
    label!: string

    /** The words it rests on, verbatim. */
    @Field(() => String, { nullable: true })
    quote!: string | null

    /** The document, for a document origin. */
    @Field(() => ID, { nullable: true })
    sourceId!: string | null

    /** The passage (chunk) of the document it was read from. */
    @Field(() => String, { nullable: true })
    chunkHash!: string | null

    /** The team-chat message, for a chat origin. */
    @Field(() => ID, { nullable: true })
    messageId!: string | null
}
