import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListVideoProjectsRequest, ListVideoProjectsResult } from "./list-video-projects.contracts"

/** The authenticated videoProjects operation. */
export class ListVideoProjectsQuery extends Query<ListVideoProjectsResult> {
    constructor(readonly params: ExecuteParams<ListVideoProjectsRequest>) {
        super()
    }
}
