import { CommandHandler } from "@nestjs/cqrs"
import { AgentEventWakesService } from "@modules/domain/agent-schedules"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SeedAgentTriggersCommand } from "./seed-agent-triggers.command"

@CommandHandler(SeedAgentTriggersCommand)
/** Hands the delivered installation_changed event to the domain service, which claims the delivery in the inbox and seeds the module's triggers. */
export class SeedAgentTriggersHandler extends ICQRSHandler<SeedAgentTriggersCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wakes: AgentEventWakesService,
    ) {
        super(logger)
    }

    protected override process(command: SeedAgentTriggersCommand): Promise<void> {
        return this.wakes.installationChanged(command.params.request.delivery.event.payload, {
            consumer: command.params.request.delivery.consumer,
            dedupeKey: command.params.request.delivery.dedupeKey,
        })
    }
}
