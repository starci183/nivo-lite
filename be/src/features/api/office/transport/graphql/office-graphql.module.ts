import { Module } from "@nestjs/common"
import { OfficeApiModule } from "../../office.module"
import { CancelOfficeCommandResolver } from "./cancel-office-command.resolver"
import { ConfirmOfficeCommandResolver } from "./confirm-office-command.resolver"
import { OfficeCommandCandidatesResolver } from "./office-command-candidates.resolver"
import { OfficeDecidedApprovalsResolver } from "./office-decided-approvals.resolver"
import { ConfigurableModuleClass } from "./office-graphql.module-definition"
import { OfficeMessagesResolver } from "./office-messages.resolver"
import { OfficePendingApprovalsResolver } from "./office-pending-approvals.resolver"
import { PostOfficeMessageResolver } from "./post-office-message.resolver"
import { ProposeOfficeCommandResolver } from "./propose-office-command.resolver"

@Module({
    imports: [OfficeApiModule.register({})],
    providers: [
        OfficeMessagesResolver,
        OfficePendingApprovalsResolver,
        OfficeDecidedApprovalsResolver,
        OfficeCommandCandidatesResolver,
        PostOfficeMessageResolver,
        ProposeOfficeCommandResolver,
        ConfirmOfficeCommandResolver,
        CancelOfficeCommandResolver,
    ],
})
/** The GraphQL transport of the office feature. */
export class OfficeGraphqlModule extends ConfigurableModuleClass {}
