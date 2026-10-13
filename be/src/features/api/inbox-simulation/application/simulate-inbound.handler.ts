import { CommandHandler } from "@nestjs/cqrs"
import { InboxSimulationService } from "@modules/domain/inbox-simulation"
import type { InboxSimulationReceipt } from "@modules/domain/inbox-simulation"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SimulateInboundCommand } from "./simulate-inbound.command"

@CommandHandler(SimulateInboundCommand)
/** Records and queues a simulated input as the signed-in member. */
export class SimulateInboundHandler extends ICQRSHandler<SimulateInboundCommand, InboxSimulationReceipt> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly simulator: InboxSimulationService,
    ) {
        super(logger)
    }

    protected override process(command: SimulateInboundCommand): Promise<InboxSimulationReceipt> {
        return this.simulator.request(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.simulation,
        )
    }
}
