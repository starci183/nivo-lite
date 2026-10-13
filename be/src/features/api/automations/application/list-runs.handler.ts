import { QueryHandler } from "@nestjs/cqrs"
import { AutomationsService } from "@modules/domain/automations"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListRunsQuery } from "./list-runs.query"
import type { ListRunsResult } from "./list-runs.contracts"

@QueryHandler(ListRunsQuery)
/** Reads the run history of the workspace or of one template. */
export class ListRunsHandler extends ICQRSHandler<ListRunsQuery, ListRunsResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly automations: AutomationsService,
    ) {
        super(logger)
    }

    protected override process(message: ListRunsQuery): Promise<ListRunsResult> {
        return this.automations.history(
            message.params.principal.id,
            message.params.request.workspaceId,
            message.params.request.templateKey,
        )
    }
}
