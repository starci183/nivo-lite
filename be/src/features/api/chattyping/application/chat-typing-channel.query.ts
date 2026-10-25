import { Query } from "@nestjs/cqrs"
import type { ChatTypingChannel } from "@modules/domain/chat-typing"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ChatTypingRequest } from "./chat-typing.contracts"

/** Asks for an authorized receive-only private typing channel. */
export class ChatTypingChannelQuery extends Query<ChatTypingChannel> {
    constructor(readonly params: ExecuteParams<ChatTypingRequest>) {
        super()
    }
}
