import { QueryHandler } from "@nestjs/cqrs"
import { SepayReviewService } from "@modules/domain/sepay-transactions"
import type { ReviewTransaction } from "@modules/domain/sepay-transactions"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BillingReviewTransactionsQuery } from "./billing-review-transactions.query"

@QueryHandler(BillingReviewTransactionsQuery)
/** Reads authorized billing-review-transactions through the billing capability. */
export class BillingReviewTransactionsHandler extends ICQRSHandler<
    BillingReviewTransactionsQuery,
    ReadonlyArray<ReviewTransaction>
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly reviews: SepayReviewService,
    ) {
        super(logger)
    }

    protected override process(query: BillingReviewTransactionsQuery): Promise<ReadonlyArray<ReviewTransaction>> {
        return this.reviews.review(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.orderIds,
        )
    }
}
