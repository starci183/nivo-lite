import { CommandHandler } from "@nestjs/cqrs"
import { TeamChatService } from "@modules/domain/team-chat"
import type { RoomView, TeamChatResult } from "@modules/domain/team-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AddChatRoomMemberCommand } from "./add-chat-room-member.command"

@CommandHandler(AddChatRoomMemberCommand)
/** Adds a member to a group. The service proves the caller's seat and the room. */
export class AddChatRoomMemberHandler extends ICQRSHandler<AddChatRoomMemberCommand, TeamChatResult<RoomView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: TeamChatService,
    ) {
        super(logger)
    }

    protected override process(command: AddChatRoomMemberCommand): Promise<TeamChatResult<RoomView>> {
        const { principal: p, request: r } = command.params
        return this.chat.addMember(r.workspaceId, p.id, r.roomId, r.member)
    }
}
