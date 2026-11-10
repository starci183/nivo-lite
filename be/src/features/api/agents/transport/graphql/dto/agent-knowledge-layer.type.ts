import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One layer of the shared knowledge as one agent sees it. */
export class AgentKnowledgeLayerType {
    /** `public`, `internal` or `restricted`. */
    @Field()
    layer!: string

    /** Whether the agent reads the layer. */
    @Field()
    isRead!: boolean

    /** How many documents the layer holds for the agent. */
    @Field(() => Int)
    documents!: number

    /** How many facts of the layer the owner approved. */
    @Field(() => Int)
    approvedFacts!: number

    /** How many facts the layer holds, approved and waiting. */
    @Field(() => Int)
    totalFacts!: number
}
