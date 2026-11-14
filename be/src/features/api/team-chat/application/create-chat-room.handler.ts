import { CommandHandler } from "@nestjs/cqrs"
import { TeamChatRoomsService, type ChatRoomView, type TeamChatResult } from "@modules/domain/team-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { CreateChatRoomCommand } from "./create-chat-room.command"

@CommandHandler(CreateChatRoomCommand)
/** Opens a direct room or a group. The service proves the caller's seat and the room. */
export class CreateChatRoomHandler extends ICQRSHandler<CreateChatRoomCommand, TeamChatResult<ChatRoomView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: TeamChatRoomsService,
    ) {
        super(logger)
    }

    protected override process(command: CreateChatRoomCommand): Promise<TeamChatResult<ChatRoomView>> {
        return this.chat.createRoom(
            command.params.request.workspaceId,
            command.params.principal.id,
            command.params.request,
        )
    }
}
