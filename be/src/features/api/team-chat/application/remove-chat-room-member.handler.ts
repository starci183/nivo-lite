import { CommandHandler } from "@nestjs/cqrs"
import { TeamChatService } from "@modules/domain/team-chat"
import type { RoomView, TeamChatResult } from "@modules/domain/team-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RemoveChatRoomMemberCommand } from "./remove-chat-room-member.command"

@CommandHandler(RemoveChatRoomMemberCommand)
/** Removes a member from a group. The service proves the caller's seat and the room. */
export class RemoveChatRoomMemberHandler extends ICQRSHandler<RemoveChatRoomMemberCommand, TeamChatResult<RoomView | null>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: TeamChatService,
    ) {
        super(logger)
    }

    protected override process(command: RemoveChatRoomMemberCommand): Promise<TeamChatResult<RoomView | null>> {
        const { principal: p, request: r } = command.params
        return this.chat.removeMember(r.workspaceId, p.id, r.roomId, r.member)
    }
}
