import { Module } from "@nestjs/common"
import { OfficeApiModule } from "../../office.module"
import { CancelOfficeCommandResolver } from "./cancel-office-command.resolver"
import { ConfirmOfficeCommandResolver } from "./confirm-office-command.resolver"
import { OfficeCommandCandidatesResolver } from "./office-command-candidates.resolver"
import { OfficeDecidedApprovalsResolver } from "./office-decided-approvals.resolver"
import { OfficeMessagesResolver } from "./office-messages.resolver"
import { OfficePendingApprovalsResolver } from "./office-pending-approvals.resolver"
import { ProposeOfficeCommandResolver } from "./propose-office-command.resolver"

@Module({
    imports: [OfficeApiModule],
    providers: [
        OfficeMessagesResolver,
        OfficePendingApprovalsResolver,
        OfficeDecidedApprovalsResolver,
        OfficeCommandCandidatesResolver,
        ProposeOfficeCommandResolver,
        ConfirmOfficeCommandResolver,
        CancelOfficeCommandResolver,
    ],
})
/** The GraphQL transport of the office feature. */
export class OfficeGraphqlModule {}
