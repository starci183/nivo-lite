import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { InstallationChangedEvent } from "@modules/events/api"
import { EVENT_CONSUMER_REGISTRY } from "@modules/platform/event-bus"
import type { EventConsumerRegistry, EventDelivery } from "@modules/platform/event-bus"
import { AgentSyncService } from "./agent-sync.service"
import { InstallationChangedConsumer } from "./installation-changed.consumer"

const delivery = (installationId?: string): EventDelivery<InstallationChangedEvent> => {
    const event = InstallationChangedEvent.create(
        { workspaceId: "ws-1", ...(installationId === undefined ? {} : { installationId }), force: true },
        "change-1",
    )
    return {
        correlationId: event.eventId,
        eventId: event.eventId,
        consumer: "installation_changed__agent_sync",
        dedupeKey: event.payload.dedupeKey,
        event,
        attempt: 1,
    }
}

describe("InstallationChangedConsumer", () => {
    const build = async () => {
        const registry = mock<EventConsumerRegistry>()
        const sync = mock<AgentSyncService>()
        sync.installationChanged.mockResolvedValue(undefined)
        const moduleRef = await Test.createTestingModule({
            providers: [
                InstallationChangedConsumer,
                { provide: EVENT_CONSUMER_REGISTRY, useValue: registry },
                { provide: AgentSyncService, useValue: sync },
            ],
        }).compile()
        return { registry, sync, subject: moduleRef.get(InstallationChangedConsumer) }
    }

    it("subscribes to the agent_sync queue of installation_changed", async () => {
        const { registry, subject } = await build()

        subject.onModuleInit()

        expect(registry.subscribe).toHaveBeenCalledWith("installation_changed__agent_sync", subject)
    })

    it("queues the sync of the change with the delivery's inbox key", async () => {
        const { sync, subject } = await build()

        await subject.handle(delivery("inst-1"))

        expect(sync.installationChanged).toHaveBeenCalledWith(
            { workspaceId: "ws-1", installationId: "inst-1", force: true },
            { consumer: "installation_changed__agent_sync", dedupeKey: "change-1" },
        )
    })

    it("queues the sync of the whole workspace when the change names no installation", async () => {
        const { sync, subject } = await build()

        await subject.handle(delivery())

        expect(sync.installationChanged).toHaveBeenCalledWith(
            { workspaceId: "ws-1", installationId: null, force: true },
            { consumer: "installation_changed__agent_sync", dedupeKey: "change-1" },
        )
    })

    it("lets a failure reach the bus so the message is retried", async () => {
        const { sync, subject } = await build()
        const cause = new Error("db down")
        sync.installationChanged.mockRejectedValue(cause)

        await expect(subject.handle(delivery("inst-1"))).rejects.toBe(cause)
    })
})
