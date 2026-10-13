import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { SendMessageRequest, SendMessageResult } from "./send-message.contracts"

/** Asks the chatbot to message a customer conversation of the workspace the API key acts for. */
export class SendMessageCommand extends Command<SendMessageResult> {
    constructor(readonly params: PublicExecuteParams<SendMessageRequest>) {
        super()
    }
}
