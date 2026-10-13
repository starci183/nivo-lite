import { QueryHandler } from "@nestjs/cqrs"
import { KnowledgeDriveService } from "@modules/domain/knowledge"
import type { DriveFolderListing } from "@modules/integrations/documents"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DriveLinkedFolderQuery } from "./drive-linked-folder.query"

@QueryHandler(DriveLinkedFolderQuery)
/** Lists the files of a pasted Google Drive folder link with the Drive access the workspace gave. */
export class DriveLinkedFolderHandler extends ICQRSHandler<DriveLinkedFolderQuery, DriveFolderListing> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly drive: KnowledgeDriveService,
    ) {
        super(logger)
    }

    protected override process(query: DriveLinkedFolderQuery): Promise<DriveFolderListing> {
        return this.drive.listLinkedFolder(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.url,
        )
    }
}
