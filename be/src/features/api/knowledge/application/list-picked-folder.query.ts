import { Query } from "@nestjs/cqrs"
import type { PickedFolder } from "@modules/domain/knowledge"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListPickedFolderRequest } from "./list-picked-folder.contracts"

/** Asks for the files of a folder picked in the Google Picker. */
export class ListPickedFolderQuery extends Query<PickedFolder> {
    constructor(readonly params: ExecuteParams<ListPickedFolderRequest>) {
        super()
    }
}
