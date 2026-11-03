import { QueryHandler } from "@nestjs/cqrs"
import { TemplateListingsService } from "@modules/domain/template-marketplace"
import type { ListingView } from "@modules/domain/template-marketplace"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { TemplateReviewQueueQuery } from "./template-review-queue.query"

@QueryHandler(TemplateReviewQueueQuery)
/** Lists the submitted listings waiting for a platform reviewer. */
export class TemplateReviewQueueHandler extends ICQRSHandler<TemplateReviewQueueQuery, ReadonlyArray<ListingView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly svc: TemplateListingsService,
    ) {
        super(logger)
    }

    protected override process(query: TemplateReviewQueueQuery): Promise<ReadonlyArray<ListingView>> {
        const pr = query.params.principal
        return this.svc.queue(pr)
    }
}
