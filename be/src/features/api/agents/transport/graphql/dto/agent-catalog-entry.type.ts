import { Field, ID, ObjectType } from "@nestjs/graphql"
import { AgentCatalogGrantType } from "./agent-catalog-grant.type"
import { AgentCatalogKnowledgeType } from "./agent-catalog-knowledge.type"

@ObjectType()
/** One agent of the catalog: the connections granted to it and what it reads. */
export class AgentCatalogEntryType {
    /** The agent. */
    @Field(() => ID)
    agentId!: string

    /** The instance of the agent, or null when it has none. */
    @Field(() => ID, { nullable: true })
    installationId!: string | null

    /** The connections granted to the agent, one entry per grant. */
    @Field(() => [AgentCatalogGrantType])
    grants!: Array<AgentCatalogGrantType>

    /** What the agent reads. */
    @Field(() => AgentCatalogKnowledgeType)
    knowledge!: AgentCatalogKnowledgeType
}
