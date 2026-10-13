import { QueryHandler } from "@nestjs/cqrs"
import { KnowledgeDriveService } from "@modules/domain/knowledge"
import type { PickedFolder } from "@modules/domain/knowledge"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListPickedFolderQuery } from "./list-picked-folder.query"

@QueryHandler(ListPickedFolderQuery)
/** Lists the picked folder through the drive service. */
export class ListPickedFolderHandler extends ICQRSHandler<ListPickedFolderQuery, PickedFolder> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly drive: KnowledgeDriveService,
    ) {
        super(logger)
    }

    protected override process(query: ListPickedFolderQuery): Promise<PickedFolder> {
        return this.drive.listPickedFolder(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.folderId,
            query.params.request.token,
        )
    }
}
