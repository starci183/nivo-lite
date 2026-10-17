import { Module } from "@nestjs/common"
import { LeadQueriesApiModule } from "../../lead-queries.module"
import { LeadBoardResolver } from "./lead-board.resolver"
import { LeadFlowResolver } from "./lead-flow.resolver"
import { LeadJourneyResolver } from "./lead-journey.resolver"
import { ConfigurableModuleClass } from "./lead-queries-graphql.module-definition"

@Module({
    imports: [LeadQueriesApiModule.register({})],
    providers: [LeadBoardResolver, LeadFlowResolver, LeadJourneyResolver],
})
/** The GraphQL transport of the workspace-scoped lead readers. */
export class LeadQueriesGraphqlModule extends ConfigurableModuleClass {}
