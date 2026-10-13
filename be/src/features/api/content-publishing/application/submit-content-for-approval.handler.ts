import { CommandHandler } from "@nestjs/cqrs"
import { ContentPublishingService } from "@modules/domain/content-publishing"
import type { SubmittedContent } from "@modules/domain/content-publishing"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SubmitContentForApprovalCommand } from "./submit-content-for-approval.command"

@CommandHandler(SubmitContentForApprovalCommand)
/** Proves manager membership and submits a complete draft through the publishing service. */
export class SubmitContentForApprovalHandler extends ICQRSHandler<SubmitContentForApprovalCommand, SubmittedContent> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly publishing: ContentPublishingService,
    ) {
        super(logger)
    }

    protected override process(command: SubmitContentForApprovalCommand): Promise<SubmittedContent> {
        return this.publishing.submit(command.params.principal.id, command.params.request)
    }
}
