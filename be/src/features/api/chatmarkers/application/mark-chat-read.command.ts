import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ChatReceiptRequest } from "./chat-markers.contracts"

/** Acknowledges the last persisted message visibly read by this member. */
export class MarkChatReadCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<ChatReceiptRequest>) {
        super()
    }
}
