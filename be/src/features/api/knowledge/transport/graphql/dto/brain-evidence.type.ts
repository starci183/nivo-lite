import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Where a fact or a lesson came from. */
export class BrainEvidenceType {
    /** The kind of evidence. */
    @Field(() => String)
    kind!: string

    /** The row or address it points at. */
    @Field(() => String)
    ref!: string

    /** A short label for people. */
    @Field(() => String)
    label!: string

    /** A verbatim excerpt. */
    @Field(() => String, { nullable: true })
    quote?: string | null | undefined

    /** When it happened, ISO 8601. */
    @Field(() => String, { nullable: true })
    at?: string | null | undefined

    /** Document evidence: the title of the document it was read from; null for any other kind. */
    @Field(() => String, { nullable: true })
    sourceTitle?: string | null | undefined

    /** Document evidence: the id of the document it was read from; null for any other kind. */
    @Field(() => ID, { nullable: true })
    sourceId?: string | null | undefined
}
