import { QueryHandler } from "@nestjs/cqrs"
import type { ContentWorkbench } from "@modules/domain/content-items"
import { ContentPlansService } from "@modules/domain/content-plans"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetContentWorkbenchQuery } from "./content-workbench.query"

@QueryHandler(GetContentWorkbenchQuery)
/** Answers contentWorkbench through the authorized content service. */
export class GetContentWorkbenchHandler extends ICQRSHandler<GetContentWorkbenchQuery, ContentWorkbench> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly plans: ContentPlansService,
    ) {
        super(logger)
    }

    protected override process(query: GetContentWorkbenchQuery): Promise<ContentWorkbench> {
        return this.plans.workbench(query.params.principal.id, query.params.request.workspaceId)
    }
}
