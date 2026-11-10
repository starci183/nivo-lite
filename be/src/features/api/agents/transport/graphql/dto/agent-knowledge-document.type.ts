import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One document that applies to an agent. */
export class AgentKnowledgeDocumentType {
    /** The document. */
    @Field(() => ID)
    id!: string

    /** The title. */
    @Field()
    title!: string

    /** The kind of source. */
    @Field()
    kind!: string

    /** `public` or `internal`. */
    @Field()
    layer!: string

    /** When it last changed, ISO 8601. */
    @Field()
    updatedAt!: string

    /** Whether the agent reads it. */
    @Field()
    isRead!: boolean

    /** How many facts read from it are approved. */
    @Field(() => Int)
    approvedFacts!: number

    /** How many facts read from it wait for the owner. */
    @Field(() => Int)
    waitingFacts!: number
}
