import { QueryHandler } from "@nestjs/cqrs"
import { AutomationsService } from "@modules/domain/automations"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { AutomationsOverview } from "@modules/domain/automations"
import { GetAutomationsQuery } from "./get-automations.query"

@QueryHandler(GetAutomationsQuery)
/** Reads the gallery, the history and the shop for previews. */
export class GetAutomationsHandler extends ICQRSHandler<GetAutomationsQuery, AutomationsOverview> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly automations: AutomationsService,
    ) {
        super(logger)
    }

    protected override process(message: GetAutomationsQuery): Promise<AutomationsOverview> {
        return this.automations.overview(message.params.principal.id, message.params.request.workspaceId)
    }
}
