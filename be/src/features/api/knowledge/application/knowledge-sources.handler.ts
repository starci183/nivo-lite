import { QueryHandler } from "@nestjs/cqrs"
import { KnowledgeSourcesListingService, type KnowledgeSourceListing } from "@modules/domain/brain"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { KnowledgeSourcesQuery } from "./knowledge-sources.query"

@QueryHandler(KnowledgeSourcesQuery)
/** Lists the documents of the workspace with what each cost in AI and where its truths stand, through the KnowledgeSourcesListingService. */
export class KnowledgeSourcesHandler extends ICQRSHandler<
    KnowledgeSourcesQuery,
    ReadonlyArray<KnowledgeSourceListing>
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly listing: KnowledgeSourcesListingService,
    ) {
        super(logger)
    }

    protected override process(query: KnowledgeSourcesQuery): Promise<ReadonlyArray<KnowledgeSourceListing>> {
        return this.listing.list(query.params.principal.id, query.params.request)
    }
}
