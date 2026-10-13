import { QueryHandler } from "@nestjs/cqrs"
import { InboxSimulationService } from "@modules/domain/inbox-simulation"
import type { InboxSimulationStatus } from "@modules/domain/inbox-simulation"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetInboundSimulationStatusQuery } from "./get-inbound-simulation-status.query"

@QueryHandler(GetInboundSimulationStatusQuery)
/** Reads one simulation's real queue state after proving workspace membership. */
export class GetInboundSimulationStatusHandler extends ICQRSHandler<
    GetInboundSimulationStatusQuery,
    InboxSimulationStatus
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly simulator: InboxSimulationService,
    ) {
        super(logger)
    }

    protected override process(query: GetInboundSimulationStatusQuery): Promise<InboxSimulationStatus> {
        return this.simulator.status(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.id,
        )
    }
}
