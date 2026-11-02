import { CommandHandler } from "@nestjs/cqrs"
import { PublicDocumentsService } from "@modules/domain/public-documents"
import type { PublicDocumentView } from "@modules/domain/public-documents"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { WritePublicDocumentCommand } from "./write-public-document.command"

@CommandHandler(WritePublicDocumentCommand)
/** Writes a public document by hand; it waits for approval. */
export class WritePublicDocumentHandler extends ICQRSHandler<WritePublicDocumentCommand, PublicDocumentView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly documents: PublicDocumentsService,
    ) {
        super(logger)
    }

    protected override process(command: WritePublicDocumentCommand): Promise<PublicDocumentView> {
        return this.documents.write(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
