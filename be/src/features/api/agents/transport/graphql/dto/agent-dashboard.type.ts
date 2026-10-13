import { Field, ObjectType } from "@nestjs/graphql"
import { AgentDashboardAgentType } from "./agent-dashboard-agent.type"
import { AgentDashboardConnectionsRegionType } from "./agent-dashboard-connections-region.type"
import { AgentDashboardDoneRegionType } from "./agent-dashboard-done-region.type"
import { AgentDashboardKnowledgeRegionType } from "./agent-dashboard-knowledge-region.type"
import { AgentDashboardWaitingRegionType } from "./agent-dashboard-waiting-region.type"

@ObjectType()
/** Everything the common regions of an agent dashboard need for one module. */
export class AgentDashboardType {
    /** The installed agent, or null when the module has none yet. */
    @Field(() => AgentDashboardAgentType, { nullable: true })
    agent?: AgentDashboardAgentType | null

    /** The decisions waiting for a person. */
    @Field(() => AgentDashboardWaitingRegionType)
    waiting!: AgentDashboardWaitingRegionType

    /** The work finished by policy in seven days. */
    @Field(() => AgentDashboardDoneRegionType)
    done!: AgentDashboardDoneRegionType

    /** The connections bound to the agent. */
    @Field(() => AgentDashboardConnectionsRegionType)
    connections!: AgentDashboardConnectionsRegionType

    /** What the agent can read. */
    @Field(() => AgentDashboardKnowledgeRegionType)
    knowledge!: AgentDashboardKnowledgeRegionType
}
