import { QueryHandler } from "@nestjs/cqrs"
import { PublicDocumentsService } from "@modules/domain/public-documents"
import type { PublicDocumentView } from "@modules/domain/public-documents"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PublicDocumentsQuery } from "./public-documents.query"

@QueryHandler(PublicDocumentsQuery)
/** Lists the public documents of the workspace that are not archived, with their sources and what was left out. */
export class PublicDocumentsHandler extends ICQRSHandler<PublicDocumentsQuery, ReadonlyArray<PublicDocumentView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly documents: PublicDocumentsService,
    ) {
        super(logger)
    }

    protected override process(query: PublicDocumentsQuery): Promise<ReadonlyArray<PublicDocumentView>> {
        return this.documents.list(query.params.principal.id, query.params.request.workspaceId)
    }
}
