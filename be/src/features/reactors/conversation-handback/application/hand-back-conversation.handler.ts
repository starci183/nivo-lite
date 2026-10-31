import { CommandHandler } from "@nestjs/cqrs"
import { ConversationHandoverService } from "@modules/domain/agent-conversations"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { HandBackConversationCommand } from "./hand-back-conversation.command"

@CommandHandler(HandBackConversationCommand)
/** Hands the delivered deal_won event to the domain service, which claims the delivery in the inbox and moves the conversation back in one transaction. */
export class HandBackConversationHandler extends ICQRSHandler<HandBackConversationCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly handover: ConversationHandoverService,
    ) {
        super(logger)
    }

    protected override process(command: HandBackConversationCommand): Promise<void> {
        return this.handover.handBack(command.params.request.delivery)
    }
}
