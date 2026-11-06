import { CommandHandler } from "@nestjs/cqrs"
import { TeamChatService } from "@modules/domain/team-chat"
import type { RoomView, TeamChatResult } from "@modules/domain/team-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetChatRoomMutedCommand } from "./set-chat-room-muted.command"

@CommandHandler(SetChatRoomMutedCommand)
/** Mutes or unmutes a room for the caller. The service proves the caller's seat and the room. */
export class SetChatRoomMutedHandler extends ICQRSHandler<SetChatRoomMutedCommand, TeamChatResult<RoomView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: TeamChatService,
    ) {
        super(logger)
    }

    protected override process(command: SetChatRoomMutedCommand): Promise<TeamChatResult<RoomView>> {
        const { principal: p, request: r } = command.params
        return this.chat.setMuted(r.workspaceId, p.id, r.roomId, r.muted)
    }
}
