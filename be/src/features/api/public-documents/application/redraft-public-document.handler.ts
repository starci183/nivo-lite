import { CommandHandler } from "@nestjs/cqrs"
import { PublicDocumentsService } from "@modules/domain/public-documents"
import type { PublicDocumentView } from "@modules/domain/public-documents"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RedraftPublicDocumentCommand } from "./redraft-public-document.command"

@CommandHandler(RedraftPublicDocumentCommand)
/** Asks NIVO to draft a public document again from the internal documents it was drafted from. */
export class RedraftPublicDocumentHandler extends ICQRSHandler<RedraftPublicDocumentCommand, PublicDocumentView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly documents: PublicDocumentsService,
    ) {
        super(logger)
    }

    protected override process(command: RedraftPublicDocumentCommand): Promise<PublicDocumentView> {
        return this.documents.redraft(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.id,
        )
    }
}
