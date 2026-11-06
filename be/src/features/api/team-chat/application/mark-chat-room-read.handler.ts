import { CommandHandler } from "@nestjs/cqrs"
import { TeamChatService } from "@modules/domain/team-chat"
import type { RoomUnread, TeamChatResult } from "@modules/domain/team-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MarkChatRoomReadCommand } from "./mark-chat-room-read.command"

@CommandHandler(MarkChatRoomReadCommand)
/** Moves the read position. The service proves the caller's seat and the room. */
export class MarkChatRoomReadHandler extends ICQRSHandler<MarkChatRoomReadCommand, TeamChatResult<RoomUnread>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: TeamChatService,
    ) {
        super(logger)
    }

    protected override process(command: MarkChatRoomReadCommand): Promise<TeamChatResult<RoomUnread>> {
        const { principal: p, request: r } = command.params
        return this.chat.markRead(r.workspaceId, p.id, r.roomId, r.messageId)
    }
}
