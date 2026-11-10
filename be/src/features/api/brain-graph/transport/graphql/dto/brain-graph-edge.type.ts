import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One edge of the truth graph. */
export class BrainGraphEdgeType {
    /** The edge id (what `unlinkBrainFacts` takes). */
    @Field(() => ID)
    id!: string

    /** The truth it starts from. */
    @Field(() => ID)
    fromFactId!: string

    /** The truth it points at. */
    @Field(() => ID)
    toFactId!: string

    /** `part_of`, `applies_to`, `depends_on`, `exception_of` or `related`. */
    @Field(() => String)
    kind!: string

    /** The relation in people's words ("giao bang"). */
    @Field(() => String, { nullable: true })
    label!: string | null

    /** Who drew it: a person's name, or NIVO for the reading. */
    @Field(() => String)
    createdBy!: string

    /** When. */
    @Field(() => String)
    createdAt!: string
}
