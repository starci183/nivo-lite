import { Query } from "@nestjs/cqrs"
import type { InboxSimulationStatus } from "@modules/domain/inbox-simulation"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetInboundSimulationStatusRequest } from "./get-inbound-simulation-status.contracts"

/** Reads the queue state and refreshed result of a simulated input. */
export class GetInboundSimulationStatusQuery extends Query<InboxSimulationStatus> {
    constructor(readonly params: ExecuteParams<GetInboundSimulationStatusRequest>) {
        super()
    }
}
