import { Module } from "@nestjs/common"
import { CancelCommandHandler } from "./application/cancel-command.handler"
import { ConfirmCommandHandler } from "./application/confirm-command.handler"
import { ListCommandCandidatesHandler } from "./application/list-command-candidates.handler"
import { ListDecidedApprovalsHandler } from "./application/list-decided-approvals.handler"
import { ListPendingApprovalsHandler } from "./application/list-pending-approvals.handler"
import { ListThreadMessagesHandler } from "./application/list-thread-messages.handler"
import { PostOfficeMessageHandler } from "./application/post-office-message.handler"
import { ProposeCommandHandler } from "./application/propose-command.handler"

@Module({
    providers: [
        CancelCommandHandler,
        ConfirmCommandHandler,
        ListCommandCandidatesHandler,
        ListDecidedApprovalsHandler,
        ListPendingApprovalsHandler,
        ListThreadMessagesHandler,
        PostOfficeMessageHandler,
        ProposeCommandHandler,
    ],
})
/** The office feature: the handlers of its application. */
export class OfficeApiModule {}
