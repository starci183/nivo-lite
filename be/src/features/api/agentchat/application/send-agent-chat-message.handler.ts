import { CommandHandler } from "@nestjs/cqrs"
import { AgentChatService } from "@modules/domain/agent-chat"
import type { QueuedAgentChatTurn } from "@modules/domain/agent-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SendAgentChatMessageCommand } from "./send-agent-chat-message.command"

@CommandHandler(SendAgentChatMessageCommand)
/** Dispatches sendAgentChatMessage to the membership-proving chat service. */
export class SendAgentChatMessageHandler extends ICQRSHandler<SendAgentChatMessageCommand, QueuedAgentChatTurn> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: AgentChatService,
    ) {
        super(logger)
    }
    protected override process(command: SendAgentChatMessageCommand): Promise<QueuedAgentChatTurn> {
        return this.chat.send(command.params.principal.id, command.params.request)
    }
}
