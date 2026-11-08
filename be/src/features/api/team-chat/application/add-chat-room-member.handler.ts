import { CommandHandler } from "@nestjs/cqrs"
import { TeamChatRoomsService, type ChatRoomView, type TeamChatResult } from "@modules/domain/team-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AddChatRoomMemberCommand } from "./add-chat-room-member.command"

@CommandHandler(AddChatRoomMemberCommand)
/** Adds a member to a group. The service proves the caller's seat and the room. */
export class AddChatRoomMemberHandler extends ICQRSHandler<AddChatRoomMemberCommand, TeamChatResult<ChatRoomView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: TeamChatRoomsService,
    ) {
        super(logger)
    }

    protected override process(command: AddChatRoomMemberCommand): Promise<TeamChatResult<ChatRoomView>> {
        return this.chat.addMember(
            command.params.request.workspaceId,
            command.params.principal.id,
            command.params.request.roomId,
            command.params.request.member,
        )
    }
}
