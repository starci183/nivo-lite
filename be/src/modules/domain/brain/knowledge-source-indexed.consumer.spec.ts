import { mock } from "@starci/jest-preset"
import { KnowledgeSourceIndexedEvent } from "@modules/events/api"
import type { EventConsumerRegistry, EventDelivery } from "@modules/platform/event-bus"
import type { IndexedSourcesService } from "./indexed-sources.service"
import { KnowledgeSourceIndexedConsumer } from "./knowledge-source-indexed.consumer"

const delivery = (): EventDelivery<KnowledgeSourceIndexedEvent> => {
    const event = KnowledgeSourceIndexedEvent.create({ sourceId: "src-1", workspaceId: "ws-1", indexedAt: 1700 })
    return {
        correlationId: event.eventId,
        eventId: event.eventId,
        consumer: "knowledge_source_indexed__brain",
        dedupeKey: event.payload.dedupeKey,
        event,
        attempt: 1,
    }
}

describe("KnowledgeSourceIndexedConsumer", () => {
    const build = () => {
        const registry = mock<EventConsumerRegistry>()
        const indexed = mock<IndexedSourcesService>()
        indexed.queueFacts.mockResolvedValue(undefined)
        return { registry, indexed, subject: new KnowledgeSourceIndexedConsumer(registry, indexed) }
    }

    it("subscribes to the brain queue of knowledge_source_indexed", () => {
        const { registry, subject } = build()

        subject.onModuleInit()

        expect(registry.subscribe).toHaveBeenCalledWith("knowledge_source_indexed__brain", subject)
    })

    it("queues the reading of the source's facts with the delivery's inbox key", async () => {
        const { indexed, subject } = build()

        await subject.handle(delivery())

        expect(indexed.queueFacts).toHaveBeenCalledWith({ sourceId: "src-1", workspaceId: "ws-1" }, 1700, {
            consumer: "knowledge_source_indexed__brain",
            dedupeKey: "src-1:1700",
        })
    })

    it("lets a failure reach the bus so the message is retried", async () => {
        const { indexed, subject } = build()
        const cause = new Error("queue down")
        indexed.queueFacts.mockRejectedValue(cause)

        await expect(subject.handle(delivery())).rejects.toBe(cause)
    })
})
