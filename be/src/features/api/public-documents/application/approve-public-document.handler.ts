import { CommandHandler } from "@nestjs/cqrs"
import { PublicDocumentsService, type PublicDocumentView } from "@modules/domain/public-documents"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ApprovePublicDocumentCommand } from "./approve-public-document.command"

@CommandHandler(ApprovePublicDocumentCommand)
/** Approves a public document and publishes it: the approver, the time and the internal sources are recorded. */
export class ApprovePublicDocumentHandler extends ICQRSHandler<ApprovePublicDocumentCommand, PublicDocumentView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly documents: PublicDocumentsService,
    ) {
        super(logger)
    }

    protected override process(command: ApprovePublicDocumentCommand): Promise<PublicDocumentView> {
        return this.documents.approve(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
