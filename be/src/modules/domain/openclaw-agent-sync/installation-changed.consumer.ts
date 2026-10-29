import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InstallationChangedEvent } from "@modules/events/api"
import { INSTALLATION_CHANGED_AGENT_SYNC_TOPIC_QUEUE, InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumer, EventConsumerRegistry, EventDelivery } from "@modules/platform/event-bus"
import { AgentSyncService } from "./agent-sync.service"

@Injectable()
/** The thin door of the `agent_sync` reactor: it reads `installation_changed` and has the OpenClaw sync queued with the delivery's key. */
export class InstallationChangedConsumer implements EventConsumer<InstallationChangedEvent>, OnModuleInit {
    readonly event = InstallationChangedEvent

    constructor(
        @InjectEventConsumerRegistry() private readonly consumers: EventConsumerRegistry,
        private readonly sync: AgentSyncService,
    ) {}

    /** Subscribes to the reactor's queue. */
    onModuleInit(): void {
        this.consumers.subscribe(INSTALLATION_CHANGED_AGENT_SYNC_TOPIC_QUEUE, this)
    }

    /** Queues the sync of what changed. */
    handle(delivery: EventDelivery<InstallationChangedEvent>): Promise<void> {
        const { workspaceId, installationId, force } = delivery.event.payload
        return this.sync.installationChanged(
            { workspaceId, installationId, force },
            { consumer: delivery.consumer, dedupeKey: delivery.dedupeKey },
        )
    }
}
