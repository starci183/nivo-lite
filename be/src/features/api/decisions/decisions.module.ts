import { Module } from "@nestjs/common"
import { CreateResponsibilityHandler } from "./application/create-responsibility.handler"
import { DecideExecutionHandler } from "./application/decide-execution.handler"
import { AssignWorkItemHandler } from "./application/assign-work-item.handler"
import { DecideWorkItemHandler } from "./application/decide-work-item.handler"
import { HoldWorkItemHandler } from "./application/hold-work-item.handler"
import { GetWorkItemHandler } from "./application/get-work-item.handler"
import { ListApproversHandler } from "./application/list-approvers.handler"
import { ListDecisionHistoryHandler } from "./application/list-decision-history.handler"
import { ListMemberGrantsHandler } from "./application/list-member-grants.handler"
import { ListResponsibilitiesHandler } from "./application/list-responsibilities.handler"
import { ListWorkItemPageHandler } from "./application/list-work-item-page.handler"
import { ReconcileDetailsHandler } from "./application/reconcile-details.handler"
import { ReadAuthorityHandler } from "./application/read-authority.handler"
import { SaveMemberGrantsHandler } from "./application/save-member-grants.handler"
import { SaveRuleHandler } from "./application/save-rule.handler"
import { SendCommandHandler } from "./application/send-command.handler"
import { UpdateAuthorityHandler } from "./application/update-authority.handler"
import { UpdateResponsibilityStatusHandler } from "./application/update-responsibility-status.handler"
import { ConfigurableModuleClass } from "./decisions.module-definition"

@Module({
    providers: [
        CreateResponsibilityHandler,
        DecideExecutionHandler,
        AssignWorkItemHandler,
        DecideWorkItemHandler,
        HoldWorkItemHandler,
        GetWorkItemHandler,
        ListApproversHandler,
        ListDecisionHistoryHandler,
        ListMemberGrantsHandler,
        ListResponsibilitiesHandler,
        ListWorkItemPageHandler,
        ReadAuthorityHandler,
        ReconcileDetailsHandler,
        SaveMemberGrantsHandler,
        SaveRuleHandler,
        SendCommandHandler,
        UpdateAuthorityHandler,
        UpdateResponsibilityStatusHandler,
    ],
})
/** The decisions feature: the handlers of its application. */
export class DecisionsApiModule extends ConfigurableModuleClass {}
