import { CommandHandler } from "@nestjs/cqrs"
import { PublicDocumentsService } from "@modules/domain/public-documents"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ArchivePublicDocumentCommand } from "./archive-public-document.command"

@CommandHandler(ArchivePublicDocumentCommand)
/** Takes a public document away from customers. */
export class ArchivePublicDocumentHandler extends ICQRSHandler<ArchivePublicDocumentCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly documents: PublicDocumentsService,
    ) {
        super(logger)
    }

    protected override process(command: ArchivePublicDocumentCommand): Promise<void> {
        return this.documents.archive(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.id,
        )
    }
}
