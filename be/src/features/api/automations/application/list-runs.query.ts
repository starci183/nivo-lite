import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListRunsRequest, ListRunsResult } from "./list-runs.contracts"

/** Reads the run history of the workspace or of one template. */
export class ListRunsQuery extends Query<ListRunsResult> {
    constructor(readonly params: ExecuteParams<ListRunsRequest>) {
        super()
    }
}
