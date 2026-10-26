import { Field, Float, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One passage an agent would retrieve for a question, labelled by layer. */
export class RetrievedPassageType {
    /** `nivo` (base knowledge), `business` (the owner's documents) or `fact` (a confirmed fact of the brain). */
    @Field(() => String)
    layer!: string

    /** The passage id. */
    @Field(() => ID)
    id!: string

    /** The document, for a business passage. */
    @Field(() => ID, { nullable: true })
    sourceId?: string | null

    /** The module. */
    @Field(() => String, { nullable: true })
    module?: string | null

    /** The kind of the document or item. */
    @Field(() => String)
    kind!: string

    /** The title. */
    @Field(() => String)
    title!: string

    /** The text. */
    @Field(() => String)
    content!: string

    /** The relevance, higher first. */
    @Field(() => Float)
    score!: number

    /** `public` or `internal` for a passage; the scope of a fact (`public`, `internal` or `restricted`). */
    @Field(() => String)
    visibility!: string

    /** The topic. */
    @Field(() => String, { nullable: true })
    topic?: string | null

    /** The order of the passage inside its document (from 0), for a business passage. */
    @Field(() => Int, { nullable: true })
    order?: number | null
}
