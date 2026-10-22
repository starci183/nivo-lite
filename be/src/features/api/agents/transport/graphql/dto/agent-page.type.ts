import { Field, ObjectType } from "@nestjs/graphql"
import { AgentOwnershipType } from "./agent-ownership.type"
import { AgentPageHeadType } from "./agent-page-head.type"
import { AgentRecentRegionType } from "./agent-recent-region.type"
import { AgentRulesRegionType } from "./agent-rules-region.type"

@ObjectType()
/** Everything the profile page of one agent shows. */
export class AgentPageType {
    /** The header. */
    @Field(() => AgentPageHeadType)
    agent!: AgentPageHeadType

    /** Who is in charge, who may give it work, whom it may tag. */
    @Field(() => AgentOwnershipType)
    ownership!: AgentOwnershipType

    /** The rules that apply to the agent. */
    @Field(() => AgentRulesRegionType)
    rules!: AgentRulesRegionType

    /** The latest work. */
    @Field(() => AgentRecentRegionType)
    recent!: AgentRecentRegionType
}
