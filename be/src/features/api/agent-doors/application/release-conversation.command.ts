import { Command } from "@nestjs/cqrs"
import type { ConversationRelease } from "@modules/domain/agent-doors"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ReleaseConversationRequest } from "./agent-doors.contracts"

/** Hands a held conversation back to the agents ("hand back to the agent"). */
export class ReleaseConversationCommand extends Command<ConversationRelease> {
    constructor(readonly params: ExecuteParams<ReleaseConversationRequest>) {
        super()
    }
}
