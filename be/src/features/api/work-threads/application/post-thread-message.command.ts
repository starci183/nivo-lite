import { Command } from "@nestjs/cqrs"
import type { ThreadMessage } from "@modules/domain/thread-messages"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { PostThreadMessageRequest } from "./post-thread-message.contracts"

/** Asks to write a message into a work thread as the signed-in member. */
export class PostThreadMessageCommand extends Command<ThreadMessage> {
    constructor(readonly params: ExecuteParams<PostThreadMessageRequest>) {
        super()
    }
}
