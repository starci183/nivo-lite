import { CommandHandler } from "@nestjs/cqrs"
import { HoldReleaseDoorService, releaseHoldOf } from "@modules/domain/agent-doors"
import type { ConversationRelease } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ReleaseConversationCommand } from "./release-conversation.command"

@CommandHandler(ReleaseConversationCommand)
/** Hands a held conversation back, for an owner or a manager; a press that released something is recorded. */
export class ReleaseConversationHandler extends ICQRSHandler<ReleaseConversationCommand, ConversationRelease> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly door: HoldReleaseDoorService,
    ) {
        super(logger)
    }

    protected override process(command: ReleaseConversationCommand): Promise<ConversationRelease> {
        const { principal, request } = command.params
        return this.door.hand(principal.id, request.workspaceId, request.conversationId, releaseHoldOf(request.hold))
    }
}
