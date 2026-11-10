import { CommandHandler } from "@nestjs/cqrs"
import { TeamChatAudienceService } from "@modules/domain/team-chat"
import type { ChatRoomView, TeamChatResult } from "@modules/domain/team-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetChatRoomPostRightCommand } from "./set-chat-room-post-right.command"

@CommandHandler(SetChatRoomPostRightCommand)
/** Grants or revokes an agent's right to post in a group. The service proves who may manage the group and refuses the rest. */
export class SetChatRoomPostRightHandler extends ICQRSHandler<
    SetChatRoomPostRightCommand,
    TeamChatResult<ChatRoomView>
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly audience: TeamChatAudienceService,
    ) {
        super(logger)
    }

    protected override process(command: SetChatRoomPostRightCommand): Promise<TeamChatResult<ChatRoomView>> {
        const r = command.params.request
        return this.audience.setPostRight(r.workspaceId, command.params.principal.id, r.roomId, r.agentId, r.mayPost)
    }
}
