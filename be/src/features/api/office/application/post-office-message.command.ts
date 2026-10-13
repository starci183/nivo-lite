import { Command } from "@nestjs/cqrs"
import type { PostedMessage } from "@modules/domain/messages"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { PostOfficeMessageRequest } from "./post-office-message.contracts"

/** Asks to post a line the caller typed in the Office thread. */
export class PostOfficeMessageCommand extends Command<PostedMessage> {
    constructor(readonly params: ExecuteParams<PostOfficeMessageRequest>) {
        super()
    }
}
