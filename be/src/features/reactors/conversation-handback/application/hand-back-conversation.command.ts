import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { HandBackConversationRequest } from "./hand-back-conversation.contracts"

/** Asks to return the conversation of a won customer to its front agent; the deal_won consumer sends it for every delivery. */
export class HandBackConversationCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<HandBackConversationRequest>) {
        super()
    }
}
