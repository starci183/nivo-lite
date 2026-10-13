import { Module } from "@nestjs/common"
import { DecisionsApiModule } from "../../decisions.module"
import { AssignWorkItemResolver } from "./assign-work-item.resolver"
import { AuthorityResolver } from "./authority.resolver"
import { CreateResponsibilityResolver } from "./create-responsibility.resolver"
import { DecideExecutionResolver } from "./decide-execution.resolver"
import { DecideWorkItemResolver } from "./decide-work-item.resolver"
import { HoldWorkItemResolver } from "./hold-work-item.resolver"
import { DecisionHistoryResolver } from "./decision-history.resolver"
import { ReconcileDetailsResolver } from "./reconcile-details.resolver"
import { ResponsibilitiesResolver } from "./responsibilities.resolver"
import { SaveAuthorityRuleResolver } from "./save-authority-rule.resolver"
import { SendAgentCommandResolver } from "./send-agent-command.resolver"
import { UpdateAuthorityResolver } from "./update-authority.resolver"
import { UpdateResponsibilityStatusResolver } from "./update-responsibility-status.resolver"
import { WorkItemResolver } from "./work-item.resolver"
import { WorkItemsResolver } from "./work-items.resolver"

@Module({
    imports: [DecisionsApiModule],
    providers: [
        AssignWorkItemResolver,
        WorkItemsResolver,
        WorkItemResolver,
        DecideWorkItemResolver,
        HoldWorkItemResolver,
        DecideExecutionResolver,
        SendAgentCommandResolver,
        DecisionHistoryResolver,
        AuthorityResolver,
        UpdateAuthorityResolver,
        SaveAuthorityRuleResolver,
        ReconcileDetailsResolver,
        ResponsibilitiesResolver,
        CreateResponsibilityResolver,
        UpdateResponsibilityStatusResolver,
    ],
})
/** The GraphQL transport of the decisions feature. */
export class DecisionsGraphqlModule {}
