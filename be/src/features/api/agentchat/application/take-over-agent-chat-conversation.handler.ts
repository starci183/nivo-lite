import { CommandHandler } from "@nestjs/cqrs"
import { AgentChatService } from "@modules/domain/agent-chat"
import type { AgentChatHolder } from "@modules/domain/agent-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { TakeOverAgentChatConversationCommand } from "./take-over-agent-chat-conversation.command"

@CommandHandler(TakeOverAgentChatConversationCommand)
/** Dispatches takeOverAgentChatConversation to the membership-proving chat service. */
export class TakeOverAgentChatConversationHandler extends ICQRSHandler<
    TakeOverAgentChatConversationCommand,
    AgentChatHolder
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: AgentChatService,
    ) {
        super(logger)
    }
    protected override process(command: TakeOverAgentChatConversationCommand): Promise<AgentChatHolder> {
        return this.chat.takeOver(command.params.principal.id, command.params.request)
    }
}
