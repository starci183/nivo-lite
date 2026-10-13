import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DriveGrantResult, GetDriveGrantRequest } from "./get-drive-grant.contracts"

/** Asks where the Google Drive read grant of the workspace stands. */
export class GetDriveGrantQuery extends Query<DriveGrantResult> {
    constructor(readonly params: ExecuteParams<GetDriveGrantRequest>) {
        super()
    }
}
