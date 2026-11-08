import { CommandHandler } from "@nestjs/cqrs"
import { TeamChatRoomsService, type ChatRoomView, type TeamChatResult } from "@modules/domain/team-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { SetChatRoomMutedCommand } from "./set-chat-room-muted.command"

@CommandHandler(SetChatRoomMutedCommand)
/** Mutes or unmutes a room for the caller. The service proves the caller's seat and the room. */
export class SetChatRoomMutedHandler extends ICQRSHandler<SetChatRoomMutedCommand, TeamChatResult<ChatRoomView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: TeamChatRoomsService,
    ) {
        super(logger)
    }

    protected override process(command: SetChatRoomMutedCommand): Promise<TeamChatResult<ChatRoomView>> {
        return this.chat.setMuted(
            command.params.request.workspaceId,
            command.params.principal.id,
            command.params.request.roomId,
            command.params.request.muted,
        )
    }
}
