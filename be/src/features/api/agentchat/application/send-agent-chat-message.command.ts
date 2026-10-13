import { Command } from "@nestjs/cqrs"
import type { SendAgentChatRequest, QueuedAgentChatTurn } from "@modules/domain/agent-chat"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** Requests sendAgentChatMessage in the caller's selected workspace. */
export class SendAgentChatMessageCommand extends Command<QueuedAgentChatTurn> {
    constructor(readonly params: ExecuteParams<SendAgentChatRequest>) {
        super()
    }
}
