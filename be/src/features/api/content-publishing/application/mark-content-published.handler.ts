import { CommandHandler } from "@nestjs/cqrs"
import type { ContentPublishedResult } from "@modules/domain/content-items"
import { ContentPublishingService } from "@modules/domain/content-publishing"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MarkContentPublishedCommand } from "./mark-content-published.command"

@CommandHandler(MarkContentPublishedCommand)
/** Records approved channel proof and workspace evidence through the publishing service. */
export class MarkContentPublishedHandler extends ICQRSHandler<MarkContentPublishedCommand, ContentPublishedResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly publishing: ContentPublishingService,
    ) {
        super(logger)
    }

    protected override process(command: MarkContentPublishedCommand): Promise<ContentPublishedResult> {
        return this.publishing.markPublished(command.params.principal.id, command.params.request)
    }
}
