import { CommandHandler } from "@nestjs/cqrs"
import { PublicDocumentsService, type PublicDocumentView } from "@modules/domain/public-documents"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { UpdatePublicDocumentCommand } from "./update-public-document.command"

@CommandHandler(UpdatePublicDocumentCommand)
/** Changes the title or the text of a public document; a published one serves its approved text until the new one is approved. */
export class UpdatePublicDocumentHandler extends ICQRSHandler<UpdatePublicDocumentCommand, PublicDocumentView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly documents: PublicDocumentsService,
    ) {
        super(logger)
    }

    protected override process(command: UpdatePublicDocumentCommand): Promise<PublicDocumentView> {
        return this.documents.update(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
