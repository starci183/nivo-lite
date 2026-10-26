import { Field, ID, ObjectType } from "@nestjs/graphql"
import { AgentKnowledgeLaneType } from "./agent-knowledge-lane.type"

@ObjectType()
/** One view of the shared knowledge: the customer's, or the one of an installed agent. */
export class AgentKnowledgeLensType {
    /** `customer` or `agent`. */
    @Field(() => String)
    kind!: string

    /** The agent, or nothing for the customer. */
    @Field(() => ID, { nullable: true })
    agentId?: string | null

    /** The agent instance the view is scoped to. */
    @Field(() => ID, { nullable: true })
    installationId?: string | null

    /** The module of the agent. */
    @Field(() => String, { nullable: true })
    module?: string | null

    /** The display name of the agent. */
    @Field(() => String, { nullable: true })
    name?: string | null

    /** The picture of the agent, or nothing for the generated avatar. */
    @Field(() => String, { nullable: true })
    avatarUrl?: string | null

    /** `customer` or `internal`. */
    @Field(() => String)
    audience!: string

    /** The kinds of knowledge the view reads. */
    @Field(() => [AgentKnowledgeLaneType])
    lanes!: Array<AgentKnowledgeLaneType>
}
