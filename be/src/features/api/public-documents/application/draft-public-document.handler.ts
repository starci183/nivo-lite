import { CommandHandler } from "@nestjs/cqrs"
import { PublicDocumentsService } from "@modules/domain/public-documents"
import type { PublicDocumentView } from "@modules/domain/public-documents"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DraftPublicDocumentCommand } from "./draft-public-document.command"

@CommandHandler(DraftPublicDocumentCommand)
/** Asks NIVO to draft a public document from internal documents; the draft is written in the background and waits for approval. */
export class DraftPublicDocumentHandler extends ICQRSHandler<DraftPublicDocumentCommand, PublicDocumentView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly documents: PublicDocumentsService,
    ) {
        super(logger)
    }

    protected override process(command: DraftPublicDocumentCommand): Promise<PublicDocumentView> {
        return this.documents.requestDraft(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
