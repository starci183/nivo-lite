import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListWorkspacesRequest, ListWorkspacesResult } from "./list-workspaces.contracts"

/** Lists every customer workspace with billing, agents, connections and activity, filtered and searched. */
export class ListWorkspacesQuery extends Query<ListWorkspacesResult> {
    constructor(readonly params: ExecuteParams<ListWorkspacesRequest>) {
        super()
    }
}
