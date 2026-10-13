import { QueryHandler } from "@nestjs/cqrs"
import { CreditsService } from "@modules/domain/credits"
import type { CreditsOverview } from "@modules/domain/credits"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetCreditsOverviewQuery } from "./get-credits-overview.query"

@QueryHandler(GetCreditsOverviewQuery)
/** Answers the credits overview from the credits service, which admits members of the workspace only. */
export class GetCreditsOverviewHandler extends ICQRSHandler<GetCreditsOverviewQuery, CreditsOverview> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly credits: CreditsService,
    ) {
        super(logger)
    }

    protected override process(query: GetCreditsOverviewQuery): Promise<CreditsOverview> {
        return this.credits.overview(query.params.principal.id, query.params.request.workspaceId)
    }
}
