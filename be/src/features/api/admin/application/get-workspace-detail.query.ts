import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetWorkspaceDetailRequest, GetWorkspaceDetailResult } from "./get-workspace-detail.contracts"

/** Answers the read-only overview of one workspace. */
export class GetWorkspaceDetailQuery extends Query<GetWorkspaceDetailResult> {
    constructor(readonly params: ExecuteParams<GetWorkspaceDetailRequest>) {
        super()
    }
}
