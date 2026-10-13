import { Query } from "@nestjs/cqrs"
import type { DriveFolderListing } from "@modules/integrations/documents"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DriveLinkedFolderRequest } from "./drive-linked-folder.contracts"

/** Lists the files of a pasted Google Drive folder link with the Drive access the workspace gave. */
export class DriveLinkedFolderQuery extends Query<DriveFolderListing> {
    constructor(readonly params: ExecuteParams<DriveLinkedFolderRequest>) {
        super()
    }
}
