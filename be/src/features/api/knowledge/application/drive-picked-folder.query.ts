import { Query } from "@nestjs/cqrs"
import type { PickedFolder } from "@modules/domain/knowledge"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DrivePickedFolderRequest } from "./drive-picked-folder.contracts"

/** Lists the files of a folder picked in the Google Picker with the short-lived token of the browser. */
export class DrivePickedFolderQuery extends Query<PickedFolder> {
    constructor(readonly params: ExecuteParams<DrivePickedFolderRequest>) {
        super()
    }
}
