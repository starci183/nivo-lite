import { Field, ObjectType } from "@nestjs/graphql"
import { AgentDashboardKnowledgeType } from "./agent-dashboard-knowledge.type"

@ObjectType()
/** The knowledge region of the dashboard: its data, or the fact that it could not be read. */
export class AgentDashboardKnowledgeRegionType {
    /** True when the region was read. */
    @Field()
    ok!: boolean

    /** The data of the region; absent when it could not be read. */
    @Field(() => AgentDashboardKnowledgeType, { nullable: true })
    data?: AgentDashboardKnowledgeType | null
}
