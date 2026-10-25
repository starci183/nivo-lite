import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { MarkConversationReadRequest } from "./mark-conversation-read.contracts"

/** Asks to mark a direct conversation read by the caller up to now. */
export class MarkConversationReadCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<MarkConversationReadRequest>) {
        super()
    }
}
