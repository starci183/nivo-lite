import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { ApprovalResolvedEvent } from "@modules/events/api"
import { APPROVAL_RESOLVED_THREAD_OUTCOMES_TOPIC_QUEUE, InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumer, EventConsumerRegistry, EventDelivery } from "@modules/platform/event-bus"
import { ThreadApprovalOutcomesService } from "./thread-approval-outcomes.service"

@Injectable()
/** The thin door of the `thread_outcomes` reactor: it reads `approval_resolved` and has the card settled with the delivery's key. */
export class ApprovalResolvedConsumer implements EventConsumer<ApprovalResolvedEvent>, OnModuleInit {
    readonly event = ApprovalResolvedEvent

    constructor(
        @InjectEventConsumerRegistry() private readonly consumers: EventConsumerRegistry,
        private readonly outcomes: ThreadApprovalOutcomesService,
    ) {}

    /** Subscribes to the reactor's queue. */
    onModuleInit(): void {
        this.consumers.subscribe(APPROVAL_RESOLVED_THREAD_OUTCOMES_TOPIC_QUEUE, this)
    }

    /** Settles the card of the request that ended. */
    handle(delivery: EventDelivery<ApprovalResolvedEvent>): Promise<void> {
        const { requestId, outcome, decidedBy } = delivery.event.payload
        return this.outcomes.resolved(
            { requestId, outcome, decidedBy: decidedBy ?? null },
            { consumer: delivery.consumer, dedupeKey: delivery.dedupeKey },
        )
    }
}
