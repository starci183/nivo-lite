import { Field, ObjectType } from "@nestjs/graphql"
import { AgentDashboardDocumentCountsType } from "./agent-dashboard-document-counts.type"
import { AgentDashboardFactCountsType } from "./agent-dashboard-fact-counts.type"
import { AgentDashboardGapsType } from "./agent-dashboard-gaps.type"

@ObjectType()
/** What the agent can read and, for a manager, what it could not answer. */
export class AgentDashboardKnowledgeType {
    /** `customer` or `internal`. */
    @Field()
    audience!: string

    /** Documents by visibility. */
    @Field(() => AgentDashboardDocumentCountsType)
    documents!: AgentDashboardDocumentCountsType

    /** Facts by visibility. */
    @Field(() => AgentDashboardFactCountsType)
    facts!: AgentDashboardFactCountsType

    /** The open gaps; null when the reader is not a manager or the gaps are not kept. */
    @Field(() => AgentDashboardGapsType, { nullable: true })
    gaps?: AgentDashboardGapsType | null
}
