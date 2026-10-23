import { CommandHandler } from "@nestjs/cqrs"
import type { ThreadMessage } from "@modules/domain/thread-messages"
import { ThreadWorkService } from "@modules/domain/thread-work"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PostThreadMessageCommand } from "./post-thread-message.command"

@CommandHandler(PostThreadMessageCommand)
/** Writes a message into a work thread as the signed-in member; an agent waiting for their answer goes on (one domain call). */
export class PostThreadMessageHandler extends ICQRSHandler<PostThreadMessageCommand, ThreadMessage> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly work: ThreadWorkService,
    ) {
        super(logger)
    }

    protected override process(command: PostThreadMessageCommand): Promise<ThreadMessage> {
        return this.work.post({ ...command.params.request, userId: command.params.principal.id })
    }
}
