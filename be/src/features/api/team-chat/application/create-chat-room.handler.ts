import { CommandHandler } from "@nestjs/cqrs"
import { TeamChatService } from "@modules/domain/team-chat"
import type { RoomView, TeamChatResult } from "@modules/domain/team-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CreateChatRoomCommand } from "./create-chat-room.command"

@CommandHandler(CreateChatRoomCommand)
/** Opens a direct room or a group. The service proves the caller's seat and the room. */
export class CreateChatRoomHandler extends ICQRSHandler<CreateChatRoomCommand, TeamChatResult<RoomView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: TeamChatService,
    ) {
        super(logger)
    }

    protected override process(command: CreateChatRoomCommand): Promise<TeamChatResult<RoomView>> {
        const { principal: p, request: r } = command.params
        return this.chat.createRoom(r.workspaceId, p.id, r)
    }
}
