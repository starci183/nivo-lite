import { CommandHandler } from "@nestjs/cqrs"
import { ContentAiService } from "@modules/domain/content-ai"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CompleteContentDraftCommand } from "./complete-content-draft.command"

@CommandHandler(CompleteContentDraftCommand)
/** Hands the delivered ai_generation_completed event to the domain service, which claims the delivery in the inbox and applies the change in one transaction. */
export class CompleteContentDraftHandler extends ICQRSHandler<CompleteContentDraftCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly content: ContentAiService,
    ) {
        super(logger)
    }

    protected override process(command: CompleteContentDraftCommand): Promise<void> {
        return this.content.complete(
            command.params.request.delivery.event.payload.workspaceId,
            command.params.request.delivery.event.payload.generationId,
            {
                consumer: command.params.request.delivery.consumer,
                dedupeKey: command.params.request.delivery.dedupeKey,
            },
        )
    }
}
