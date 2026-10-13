import { Command } from "@nestjs/cqrs"
import type { StartAgentChatRequest } from "@modules/domain/agent-chat"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** Requests startAgentChatConversation in the caller's selected workspace. */
export class StartAgentChatConversationCommand extends Command<string> {
    constructor(readonly params: ExecuteParams<StartAgentChatRequest>) {
        super()
    }
}
