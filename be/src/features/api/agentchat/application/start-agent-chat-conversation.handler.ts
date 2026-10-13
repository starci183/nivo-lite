import { CommandHandler } from "@nestjs/cqrs"
import { AgentChatService } from "@modules/domain/agent-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { StartAgentChatConversationCommand } from "./start-agent-chat-conversation.command"

@CommandHandler(StartAgentChatConversationCommand)
/** Dispatches startAgentChatConversation to the membership-proving chat service. */
export class StartAgentChatConversationHandler extends ICQRSHandler<StartAgentChatConversationCommand, string> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: AgentChatService,
    ) {
        super(logger)
    }
    protected override process(command: StartAgentChatConversationCommand): Promise<string> {
        return this.chat.start(command.params.principal.id, command.params.request)
    }
}
