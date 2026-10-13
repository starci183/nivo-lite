import { QueryHandler } from "@nestjs/cqrs"
import { BrainPageService } from "@modules/domain/brain"
import type { BrainOverview } from "@modules/domain/brain"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetBrainQuery } from "./get-brain.query"

@QueryHandler(GetBrainQuery)
/** Reads everything the Second Brain page shows. */
export class GetBrainHandler extends ICQRSHandler<GetBrainQuery, BrainOverview> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly page: BrainPageService,
    ) {
        super(logger)
    }

    protected override process(query: GetBrainQuery): Promise<BrainOverview> {
        return this.page.overview(query.params.principal.id, query.params.request.workspaceId)
    }
}
