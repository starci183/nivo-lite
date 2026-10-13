import { Query } from "@nestjs/cqrs"
import type { DriveFolderListing } from "@modules/integrations/documents"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListLinkedFolderRequest } from "./list-linked-folder.contracts"

/** Asks for the files of a pasted Google Drive folder link. */
export class ListLinkedFolderQuery extends Query<DriveFolderListing> {
    constructor(readonly params: ExecuteParams<ListLinkedFolderRequest>) {
        super()
    }
}
