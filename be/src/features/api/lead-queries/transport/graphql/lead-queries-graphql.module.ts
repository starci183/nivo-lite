import { Module } from "@nestjs/common"
import { LeadQueriesApiModule } from "../../lead-queries.module"
import { LeadBoardResolver } from "./lead-board.resolver"
import { LeadFlowResolver } from "./lead-flow.resolver"
import { LeadJourneyResolver } from "./lead-journey.resolver"

@Module({ imports: [LeadQueriesApiModule], providers: [LeadBoardResolver, LeadFlowResolver, LeadJourneyResolver] })
/** The GraphQL transport of the workspace-scoped lead readers. */
export class LeadQueriesGraphqlModule {}
