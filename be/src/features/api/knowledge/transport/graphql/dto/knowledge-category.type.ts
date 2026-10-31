import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What the documents of one category (topic) hold together. */
export class KnowledgeCategoryType {
    /** The topic label the documents share. */
    @Field(() => String)
    topic!: string

    /** The number its folder carries, or null when no document says. */
    @Field(() => Int, { nullable: true })
    order?: number | null

    /** How many documents carry it. */
    @Field(() => Int)
    documentCount!: number

    /** The raw bytes those documents hold. */
    @Field(() => Int)
    sizeBytes!: number
}
