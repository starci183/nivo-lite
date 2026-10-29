import { mock } from "@starci/jest-preset"
import { InstallationChangedEvent } from "@modules/events/api"
import type { EventConsumerRegistry, EventDelivery } from "@modules/platform/event-bus"
import type { AgentSyncService } from "./agent-sync.service"
import { InstallationChangedConsumer } from "./installation-changed.consumer"

const delivery = (): EventDelivery<InstallationChangedEvent> => {
    const event = InstallationChangedEvent.create(
        { workspaceId: "ws-1", installationId: "inst-1", force: true },
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
    const build = () => {
        const registry = mock<EventConsumerRegistry>()
        const sync = mock<AgentSyncService>()
        sync.installationChanged.mockResolvedValue(undefined)
        return { registry, sync, subject: new InstallationChangedConsumer(registry, sync) }
    }

    it("subscribes to the agent_sync queue of installation_changed", () => {
        const { registry, subject } = build()

        subject.onModuleInit()

        expect(registry.subscribe).toHaveBeenCalledWith("installation_changed__agent_sync", subject)
    })

    it("queues the sync of the change with the delivery's inbox key", async () => {
        const { sync, subject } = build()

        await subject.handle(delivery())

        expect(sync.installationChanged).toHaveBeenCalledWith(
            { workspaceId: "ws-1", installationId: "inst-1", force: true },
            { consumer: "installation_changed__agent_sync", dedupeKey: "change-1" },
        )
    })

    it("lets a failure reach the bus so the message is retried", async () => {
        const { sync, subject } = build()
        const cause = new Error("db down")
        sync.installationChanged.mockRejectedValue(cause)

        await expect(subject.handle(delivery())).rejects.toBe(cause)
    })
})
