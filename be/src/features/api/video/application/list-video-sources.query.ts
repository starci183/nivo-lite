import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListVideoSourcesRequest, ListVideoSourcesResult } from "./list-video-sources.contracts"

/** The authenticated videoSources operation. */
export class ListVideoSourcesQuery extends Query<ListVideoSourcesResult> {
    constructor(readonly params: ExecuteParams<ListVideoSourcesRequest>) {
        super()
    }
}
