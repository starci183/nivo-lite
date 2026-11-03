import { Query } from "@nestjs/cqrs"
import type { ListingView } from "@modules/domain/template-marketplace"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { TemplateReviewQueueRequest } from "./template-review-queue.contracts"

/** Lists the submitted listings waiting for a platform reviewer. */
export class TemplateReviewQueueQuery extends Query<ReadonlyArray<ListingView>> {
    constructor(readonly params: ExecuteParams<TemplateReviewQueueRequest>) {
        super()
    }
}
