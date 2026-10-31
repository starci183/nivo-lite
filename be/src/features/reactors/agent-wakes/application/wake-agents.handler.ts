import { CommandHandler } from "@nestjs/cqrs"
import { AgentEventWakesService } from "@modules/domain/agent-schedules"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { WakeAgentsCommand } from "./wake-agents.command"

@CommandHandler(WakeAgentsCommand)
/** Hands the delivered internal event to the domain service, which claims the delivery in the inbox and writes the wakes in one transaction. */
export class WakeAgentsHandler extends ICQRSHandler<WakeAgentsCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wakes: AgentEventWakesService,
    ) {
        super(logger)
    }

    protected override process(command: WakeAgentsCommand): Promise<void> {
        return this.wakes.eventHappened(command.params.request.fact, command.params.request.claim)
    }
}
