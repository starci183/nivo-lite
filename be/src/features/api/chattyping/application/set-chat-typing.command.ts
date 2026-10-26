import { Command } from "@nestjs/cqrs"
import type { ChatTypingSignal } from "@modules/domain/chat-typing"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetChatTypingRequest } from "./chat-typing.contracts"

/** Sets the authenticated member's short-lived typing signal. */
export class SetChatTypingCommand extends Command<ChatTypingSignal> {
    constructor(readonly params: ExecuteParams<SetChatTypingRequest>) {
        super()
    }
}
