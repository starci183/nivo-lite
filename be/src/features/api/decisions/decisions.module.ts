import { Module } from "@nestjs/common"
import { ApproverDirectoryService } from "@modules/domain/agent-pages"
import { ListApproversHandler } from "./application/list-approvers.handler"
import { ConfigurableModuleClass } from "./decisions.module-definition"

@Module({
    providers: [ApproverDirectoryService, ListApproversHandler],
})
/** The governance door of the decisions feature: the handler of the approver directory. */
export class DecisionsApiModule extends ConfigurableModuleClass {}
