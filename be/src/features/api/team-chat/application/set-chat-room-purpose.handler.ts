import { CommandHandler } from "@nestjs/cqrs"
import { TeamChatAudienceService } from "@modules/domain/team-chat"
import type { ChatRoomView, TeamChatResult } from "@modules/domain/team-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetChatRoomPurposeCommand } from "./set-chat-room-purpose.command"

@CommandHandler(SetChatRoomPurposeCommand)
/** Gives a group its purpose. The service proves who may manage the group and refuses the rest. */
export class SetChatRoomPurposeHandler extends ICQRSHandler<SetChatRoomPurposeCommand, TeamChatResult<ChatRoomView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly audience: TeamChatAudienceService,
    ) {
        super(logger)
    }

    protected override process(command: SetChatRoomPurposeCommand): Promise<TeamChatResult<ChatRoomView>> {
        const r = command.params.request
        return this.audience.setRoomPurpose(r.workspaceId, command.params.principal.id, r.roomId, r.purpose)
    }
}
