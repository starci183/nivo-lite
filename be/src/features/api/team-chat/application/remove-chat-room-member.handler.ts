import { CommandHandler } from "@nestjs/cqrs"
import { TeamChatRoomsService, type ChatRoomView, type TeamChatResult } from "@modules/domain/team-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { RemoveChatRoomMemberCommand } from "./remove-chat-room-member.command"

@CommandHandler(RemoveChatRoomMemberCommand)
/** Removes a member from a group. The service proves the caller's seat and the room. */
export class RemoveChatRoomMemberHandler extends ICQRSHandler<
    RemoveChatRoomMemberCommand,
    TeamChatResult<ChatRoomView | null>
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: TeamChatRoomsService,
    ) {
        super(logger)
    }

    protected override process(command: RemoveChatRoomMemberCommand): Promise<TeamChatResult<ChatRoomView | null>> {
        return this.chat.removeMember(
            command.params.request.workspaceId,
            command.params.principal.id,
            command.params.request.roomId,
            command.params.request.member,
        )
    }
}
