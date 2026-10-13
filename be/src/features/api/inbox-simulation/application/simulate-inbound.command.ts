import { Command } from "@nestjs/cqrs"
import type { InboxSimulationReceipt } from "@modules/domain/inbox-simulation"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SimulateInboundRequest } from "./simulate-inbound.contracts"

/** Requests that an input be recorded and its department work queued. */
export class SimulateInboundCommand extends Command<InboxSimulationReceipt> {
    constructor(readonly params: ExecuteParams<SimulateInboundRequest>) {
        super()
    }
}
