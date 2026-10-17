import { Module } from "@nestjs/common"
import { CreateLeadHandler } from "./application/create-lead.handler"
import { RefreshLeadContextHandler } from "./application/refresh-lead-context.handler"
import { SuggestLeadOwnerHandler } from "./application/suggest-lead-owner.handler"
import { DraftLeadExecutionHandler } from "./application/draft-lead-execution.handler"
import { SettleWonDealHandler } from "./application/settle-won-deal.handler"
import { LeadActionStatusHandler } from "./application/lead-action-status.handler"
import { ConfigurableModuleClass } from "./lead-actions.module-definition"

@Module({
    providers: [
        CreateLeadHandler,
        RefreshLeadContextHandler,
        SuggestLeadOwnerHandler,
        DraftLeadExecutionHandler,
        SettleWonDealHandler,
        LeadActionStatusHandler,
    ],
})
/** Application handlers of the asynchronous lead actions feature. */
export class LeadActionsApiModule extends ConfigurableModuleClass {}
