import { Command } from "@nestjs/cqrs"
import type { TakeOverAgentChatRequest, AgentChatHolder } from "@modules/domain/agent-chat"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** Requests takeOverAgentChatConversation in the caller's selected workspace. */
export class TakeOverAgentChatConversationCommand extends Command<AgentChatHolder> {
    constructor(readonly params: ExecuteParams<TakeOverAgentChatRequest>) {
        super()
    }
}
