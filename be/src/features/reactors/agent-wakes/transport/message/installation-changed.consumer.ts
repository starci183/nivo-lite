import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { InstallationChangedEvent } from "@modules/events/api"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { SeedAgentTriggersCommand } from "../../application/seed-agent-triggers.command"

@Injectable()
/** The consumer door of the installation_changed event in the agent-wakes reactor: it dispatches one command and forwards the event id. */
export class InstallationChangedConsumer implements EventConsumer<InstallationChangedEvent> {
    readonly event = InstallationChangedEvent

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Delivery is at least once: the domain service the command reaches claims the delivery in the inbox inside its own transaction. */
    async handle(delivery: EventDelivery<InstallationChangedEvent>): Promise<void> {
        await this.commandBus.execute(
            new SeedAgentTriggersCommand({
                request: { eventId: delivery.eventId, delivery, correlationId: delivery.correlationId },
            }),
        )
    }
}
