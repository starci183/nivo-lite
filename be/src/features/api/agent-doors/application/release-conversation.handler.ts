import { CommandHandler } from "@nestjs/cqrs"
import { HoldReleaseDoorService, type ConversationRelease } from "@modules/domain/agent-doors"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ReleaseConversationCommand } from "./release-conversation.command"

@CommandHandler(ReleaseConversationCommand)
/** Hands a conversation back to the agents (one resume event for its route), for an owner or a manager; a press that woke one is recorded. */
export class ReleaseConversationHandler extends ICQRSHandler<ReleaseConversationCommand, ConversationRelease> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly door: HoldReleaseDoorService,
    ) {
        super(logger)
    }

    protected override process(command: ReleaseConversationCommand): Promise<ConversationRelease> {
        return this.door.hand(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.conversationId,
        )
    }
}
