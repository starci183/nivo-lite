import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ChatReceiptRequest } from "./chat-markers.contracts"

/** Acknowledges a persisted message actually fetched by this member's client. */
export class MarkChatDeliveredCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<ChatReceiptRequest>) {
        super()
    }
}
