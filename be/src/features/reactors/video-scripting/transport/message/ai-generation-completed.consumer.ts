import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { AiGenerationCompletedEvent } from "@modules/events/api"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { CompleteVideoScriptCommand } from "../../application/complete-video-script.command"

@Injectable()
/** The consumer door of the ai_generation_completed event in the video-scripting reactor: it dispatches one command and forwards the event id. */
export class AiGenerationCompletedConsumer implements EventConsumer<AiGenerationCompletedEvent> {
    readonly event = AiGenerationCompletedEvent

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Delivery is at least once: the domain service the command reaches claims the delivery in the inbox inside its own transaction. */
    async handle(delivery: EventDelivery<AiGenerationCompletedEvent>): Promise<void> {
        await this.commandBus.execute(
            new CompleteVideoScriptCommand({
                request: { eventId: delivery.eventId, delivery, correlationId: delivery.correlationId },
            }),
        )
    }
}
