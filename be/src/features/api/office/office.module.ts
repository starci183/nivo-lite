import { Module } from "@nestjs/common"
import { CancelCommandHandler } from "./application/cancel-command.handler"
import { ConfirmCommandHandler } from "./application/confirm-command.handler"
import { ListCommandCandidatesHandler } from "./application/list-command-candidates.handler"
import { ListConversationUnreadHandler } from "./application/list-conversation-unread.handler"
import { ListDecidedApprovalsHandler } from "./application/list-decided-approvals.handler"
import { ListOfficeRoomsHandler } from "./application/list-office-rooms.handler"
import { ListPendingApprovalsHandler } from "./application/list-pending-approvals.handler"
import { ListThreadMessagesHandler } from "./application/list-thread-messages.handler"
import { MarkConversationReadHandler } from "./application/mark-conversation-read.handler"
import { MarkRoomReadHandler } from "./application/mark-room-read.handler"
import { PostOfficeMessageHandler } from "./application/post-office-message.handler"
import { ProposeCommandHandler } from "./application/propose-command.handler"
import { SetupOfficeRoomsHandler } from "./application/setup-office-rooms.handler"
import { ConfigurableModuleClass } from "./office.module-definition"

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
        ListOfficeRoomsHandler,
        ListConversationUnreadHandler,
        MarkRoomReadHandler,
        MarkConversationReadHandler,
        SetupOfficeRoomsHandler,
    ],
})
/** The office feature: the handlers of its application. */
export class OfficeApiModule extends ConfigurableModuleClass {}
