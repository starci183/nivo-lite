import { Module } from "@nestjs/common"
import { LeadBoardHandler } from "./application/lead-board.handler"
import { LeadFlowHandler } from "./application/lead-flow.handler"
import { LeadJourneyHandler } from "./application/lead-journey.handler"
import { ConfigurableModuleClass } from "./lead-queries.module-definition"

@Module({ providers: [LeadBoardHandler, LeadFlowHandler, LeadJourneyHandler] })
/** The lead readers composed over the owning capabilities. */
export class LeadQueriesApiModule extends ConfigurableModuleClass {}
