import { QueryHandler } from "@nestjs/cqrs"
import { CareOptOutService, type CareOptOutView } from "@modules/domain/agent-doors"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ReadCareOptOutQuery } from "./read-care-opt-out.query"

@QueryHandler(ReadCareOptOutQuery)
/** Reads a customer's care opt-out, for an owner or a manager. */
export class ReadCareOptOutHandler extends ICQRSHandler<ReadCareOptOutQuery, CareOptOutView | null> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly optOuts: CareOptOutService,
    ) {
        super(logger)
    }

    protected override process(query: ReadCareOptOutQuery): Promise<CareOptOutView | null> {
        return this.optOuts.read(query.params.principal.id, query.params.request.workspaceId, query.params.request.leadId)
    }
}
