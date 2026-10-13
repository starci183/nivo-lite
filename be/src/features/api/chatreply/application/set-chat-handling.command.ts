import { Command } from "@nestjs/cqrs"
import type { ChatHandlingResult } from "@modules/domain/chatreply"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetChatHandlingRequest } from "./set-chat-handling.contracts"

/** Takes over a customer conversation or releases it to the AI. */
export class SetChatHandlingCommand extends Command<ChatHandlingResult> {
    constructor(readonly params: ExecuteParams<SetChatHandlingRequest>) {
        super()
    }
}
