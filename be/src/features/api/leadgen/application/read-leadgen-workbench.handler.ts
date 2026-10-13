import { QueryHandler } from "@nestjs/cqrs"
import { LeadGenWorkbenchService } from "@modules/domain/leads"
import type { LeadGenWorkbenchData } from "@modules/domain/leads"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReadLeadGenWorkbenchQuery } from "./read-leadgen-workbench.query"

@QueryHandler(ReadLeadGenWorkbenchQuery)
/** Answers the lead prospects, origins, comments and handoffs through the owning capability. */
export class ReadLeadGenWorkbenchHandler extends ICQRSHandler<ReadLeadGenWorkbenchQuery, LeadGenWorkbenchData> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly leadgen: LeadGenWorkbenchService,
    ) {
        super(logger)
    }

    protected override process(query: ReadLeadGenWorkbenchQuery): Promise<LeadGenWorkbenchData> {
        return this.leadgen.read(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.installationId,
        )
    }
}
