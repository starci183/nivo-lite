import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** An unanswered question in the shared workspace brain. */
export class ChatbotKnowledgeGapType {
    /** The id value. */
    @Field(() => ID)
    id!: string

    /** The module value. */
    @Field(() => String)
    module!: string

    /** The question value. */
    @Field(() => String)
    question!: string

    /** The topic value. */
    @Field(() => String, { nullable: true })
    topic!: string | null

    /** The attribute guess value. */
    @Field(() => String, { nullable: true })
    attributeGuess!: string | null

    /** The count value. */
    @Field(() => Int)
    count!: number

    /** The first seen at value. */
    @Field(() => String)
    firstSeenAt!: string

    /** The last seen at value. */
    @Field(() => String)
    lastSeenAt!: string

    /** The example conversation id value. */
    @Field(() => ID, { nullable: true })
    exampleConversationId!: string | null

    /** The status value. */
    @Field(() => String)
    status!: string

    /** The reopened count value. */
    @Field(() => Int)
    reopenedCount!: number
}
