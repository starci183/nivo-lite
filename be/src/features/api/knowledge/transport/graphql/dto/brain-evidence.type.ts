import { Field, ObjectType } from "@nestjs/graphql"

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
    quote?: string | null

    /** When it happened, ISO 8601. */
    @Field(() => String, { nullable: true })
    at?: string | null
}
