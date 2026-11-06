import { Module } from "@nestjs/common"
import { ListApproversHandler } from "./application/list-approvers.handler"
import { ListMemberGrantsHandler } from "./application/list-member-grants.handler"
import { ReadAuthorityHandler } from "./application/read-authority.handler"
import { SaveMemberGrantsHandler } from "./application/save-member-grants.handler"
import { SaveRuleHandler } from "./application/save-rule.handler"
import { UpdateAuthorityHandler } from "./application/update-authority.handler"
import { ConfigurableModuleClass } from "./decisions.module-definition"

@Module({
    providers: [
        ListApproversHandler,
        ListMemberGrantsHandler,
        ReadAuthorityHandler,
        SaveMemberGrantsHandler,
        SaveRuleHandler,
        UpdateAuthorityHandler,
    ],
})
/** The governance doors of the decisions feature: the handlers of the authority sheet, its rules and the member grants. */
export class DecisionsApiModule extends ConfigurableModuleClass {}
