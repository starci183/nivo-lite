import { QueryHandler } from "@nestjs/cqrs"
import { AutomationsService } from "@modules/domain/automations"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SuggestAutomationsQuery } from "./suggest-automations.query"
import type { SuggestAutomationsResult } from "./suggest-automations.contracts"

@QueryHandler(SuggestAutomationsQuery)
/** Lists the templates worth proposing for a module. */
export class SuggestAutomationsHandler extends ICQRSHandler<SuggestAutomationsQuery, SuggestAutomationsResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly automations: AutomationsService,
    ) {
        super(logger)
    }

    protected override process(message: SuggestAutomationsQuery): Promise<SuggestAutomationsResult> {
        return this.automations.suggestFor(
            message.params.principal.id,
            message.params.request.workspaceId,
            message.params.request.moduleKey,
        )
    }
}
