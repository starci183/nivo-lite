import { Module } from "@nestjs/common"
import { LeadActionsApiModule } from "../../lead-actions.module"
import { CreateLeadResolver } from "./create-lead.resolver"
import { ConfigurableModuleClass } from "./lead-actions-graphql.module-definition"
import { RefreshLeadContextResolver } from "./refresh-lead-context.resolver"
import { SuggestLeadOwnerResolver } from "./suggest-lead-owner.resolver"
import { DraftLeadExecutionResolver } from "./draft-lead-execution.resolver"
import { SettleWonDealResolver } from "./settle-won-deal.resolver"
import { LeadActionStatusResolver } from "./lead-action-status.resolver"

@Module({
    imports: [LeadActionsApiModule.register({})],
    providers: [
        CreateLeadResolver,
        RefreshLeadContextResolver,
        SuggestLeadOwnerResolver,
        DraftLeadExecutionResolver,
        SettleWonDealResolver,
        LeadActionStatusResolver,
    ],
})
/** GraphQL mutations and status polling for queued lead actions. */
export class LeadActionsGraphqlModule extends ConfigurableModuleClass {}
