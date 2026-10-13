import { Module } from "@nestjs/common"
import { CreateResponsibilityHandler } from "./application/create-responsibility.handler"
import { DecideExecutionHandler } from "./application/decide-execution.handler"
import { DecideWorkItemHandler } from "./application/decide-work-item.handler"
import { GetWorkItemHandler } from "./application/get-work-item.handler"
import { ListDecisionHistoryHandler } from "./application/list-decision-history.handler"
import { ListResponsibilitiesHandler } from "./application/list-responsibilities.handler"
import { ListWorkItemPageHandler } from "./application/list-work-item-page.handler"
import { ReadAuthorityHandler } from "./application/read-authority.handler"
import { SaveRuleHandler } from "./application/save-rule.handler"
import { SendCommandHandler } from "./application/send-command.handler"
import { UpdateAuthorityHandler } from "./application/update-authority.handler"
import { UpdateResponsibilityStatusHandler } from "./application/update-responsibility-status.handler"

@Module({
    providers: [
        CreateResponsibilityHandler,
        DecideExecutionHandler,
        DecideWorkItemHandler,
        GetWorkItemHandler,
        ListDecisionHistoryHandler,
        ListResponsibilitiesHandler,
        ListWorkItemPageHandler,
        ReadAuthorityHandler,
        SaveRuleHandler,
        SendCommandHandler,
        UpdateAuthorityHandler,
        UpdateResponsibilityStatusHandler,
    ],
})
/** The decisions feature: the handlers of its application. */
export class DecisionsApiModule {}
