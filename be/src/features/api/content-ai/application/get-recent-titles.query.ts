import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetRecentTitlesRequest } from "./get-recent-titles.contracts"

/** Requests recent titles used to avoid repeating a content angle. */
export class GetRecentTitlesQuery extends Query<ReadonlyArray<string>> {
    constructor(readonly params: ExecuteParams<GetRecentTitlesRequest>) {
        super()
    }
}
