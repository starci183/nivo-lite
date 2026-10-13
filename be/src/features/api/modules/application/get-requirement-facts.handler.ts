import { QueryHandler } from "@nestjs/cqrs"
import { ModuleInstallService } from "@modules/domain/modules"
import type { RequirementFacts } from "@modules/domain/module-installations"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetRequirementFactsQuery } from "./get-requirement-facts.query"

@QueryHandler(GetRequirementFactsQuery)
/** Answers the requirement facts from the module install service. */
export class GetRequirementFactsHandler extends ICQRSHandler<GetRequirementFactsQuery, RequirementFacts> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly installs: ModuleInstallService,
    ) {
        super(logger)
    }

    protected override process(query: GetRequirementFactsQuery): Promise<RequirementFacts> {
        return this.installs.requirementFacts(query.params.principal.id, query.params.request.workspaceId)
    }
}
