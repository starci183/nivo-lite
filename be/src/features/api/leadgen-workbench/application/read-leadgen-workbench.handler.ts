import { QueryHandler } from "@nestjs/cqrs"
import { LeadGenWorkbenchService } from "@modules/domain/leadgen-workbench"
import type { LeadGenWorkbench } from "@modules/domain/leadgen-workbench"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReadLeadGenWorkbenchQuery } from "./read-leadgen-workbench.query"

@QueryHandler(ReadLeadGenWorkbenchQuery)
/** Reads the Lead Gen workbench after the domain proves membership. */
export class ReadLeadGenWorkbenchHandler extends ICQRSHandler<ReadLeadGenWorkbenchQuery, LeadGenWorkbench> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly workbench: LeadGenWorkbenchService,
    ) {
        super(logger)
    }

    protected override process(query: ReadLeadGenWorkbenchQuery): Promise<LeadGenWorkbench> {
        return this.workbench.read(query.params.principal.id, query.params.request)
    }
}
