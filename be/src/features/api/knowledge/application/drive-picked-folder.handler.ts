import { QueryHandler } from "@nestjs/cqrs"
import { KnowledgeDriveService } from "@modules/domain/knowledge"
import type { PickedFolder } from "@modules/domain/knowledge"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DrivePickedFolderQuery } from "./drive-picked-folder.query"

@QueryHandler(DrivePickedFolderQuery)
/** Lists the files of a folder picked in the Google Picker with the short-lived token of the browser. */
export class DrivePickedFolderHandler extends ICQRSHandler<DrivePickedFolderQuery, PickedFolder> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly drive: KnowledgeDriveService,
    ) {
        super(logger)
    }

    protected override process(query: DrivePickedFolderQuery): Promise<PickedFolder> {
        return this.drive.listPickedFolder(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.folderId,
            query.params.request.token,
        )
    }
}
