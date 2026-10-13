import { QueryHandler } from "@nestjs/cqrs"
import { KnowledgeDriveService } from "@modules/domain/knowledge"
import type { DriveFolderListing } from "@modules/integrations/documents"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListLinkedFolderQuery } from "./list-linked-folder.query"

@QueryHandler(ListLinkedFolderQuery)
/** Lists the folder through the drive service. */
export class ListLinkedFolderHandler extends ICQRSHandler<ListLinkedFolderQuery, DriveFolderListing> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly drive: KnowledgeDriveService,
    ) {
        super(logger)
    }

    protected override process(query: ListLinkedFolderQuery): Promise<DriveFolderListing> {
        return this.drive.listLinkedFolder(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.url,
        )
    }
}
