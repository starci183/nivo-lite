import { CommandHandler } from "@nestjs/cqrs"
import { ThreadMessagesService } from "@modules/domain/thread-messages"
import type { ThreadMessage } from "@modules/domain/thread-messages"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PostThreadMessageCommand } from "./post-thread-message.command"

@CommandHandler(PostThreadMessageCommand)
/** Writes a message into a work thread as the signed-in member through one domain-service call. */
export class PostThreadMessageHandler extends ICQRSHandler<PostThreadMessageCommand, ThreadMessage> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly messages: ThreadMessagesService,
    ) {
        super(logger)
    }

    protected override process(command: PostThreadMessageCommand): Promise<ThreadMessage> {
        return this.messages.postAsUser({ ...command.params.request, userId: command.params.principal.id })
    }
}
