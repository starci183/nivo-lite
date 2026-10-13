import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One passage agents retrieve from a document. */
export class DocumentPassageType {
    /** The passage id. */
    @Field(() => ID)
    id!: string

    /** The order of the passage in its document. */
    @Field(() => Int)
    order!: number

    /** The text. */
    @Field(() => String)
    content!: string

    /** Whether the passage has a vector. */
    @Field(() => Boolean)
    hasEmbedding!: boolean
}
