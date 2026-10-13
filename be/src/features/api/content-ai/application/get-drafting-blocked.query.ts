import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetDraftingBlockedRequest } from "./get-drafting-blocked.contracts"

/** Requests whether the owner disabled automated post drafting. */
export class GetDraftingBlockedQuery extends Query<boolean> {
    constructor(readonly params: ExecuteParams<GetDraftingBlockedRequest>) {
        super()
    }
}
