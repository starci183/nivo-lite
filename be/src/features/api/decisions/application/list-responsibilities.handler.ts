import { QueryHandler } from "@nestjs/cqrs"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import type { ResponsibilityListing } from "@modules/domain/responsibilities"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListResponsibilitiesQuery } from "./list-responsibilities.query"

@QueryHandler(ListResponsibilitiesQuery)
/** Answers the responsibilities from the journal service. */
export class ListResponsibilitiesHandler extends ICQRSHandler<
    ListResponsibilitiesQuery,
    ReadonlyArray<ResponsibilityListing>
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly journal: ResponsibilityJournalService,
    ) {
        super(logger)
    }

    protected override process(query: ListResponsibilitiesQuery): Promise<ReadonlyArray<ResponsibilityListing>> {
        return this.journal.list(query.params.principal.id, query.params.request.workspaceId)
    }
}
