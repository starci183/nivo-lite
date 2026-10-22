import { CommandHandler } from "@nestjs/cqrs"
import { ThreadFeedService } from "@modules/domain/thread-messages"
import type { WorkThread } from "@modules/domain/work-threads"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CreateWorkThreadCommand } from "./create-work-thread.command"

@CommandHandler(CreateWorkThreadCommand)
/** Opens a work thread through one domain-service call. */
export class CreateWorkThreadHandler extends ICQRSHandler<CreateWorkThreadCommand, WorkThread> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly feed: ThreadFeedService,
    ) {
        super(logger)
    }

    protected override process(command: CreateWorkThreadCommand): Promise<WorkThread> {
        return this.feed.open({ ...command.params.request, userId: command.params.principal.id })
    }
}
