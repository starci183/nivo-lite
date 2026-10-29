import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AiGenerationCompletedEvent } from "@modules/events/api"
import { EVENT_CONSUMER_REGISTRY } from "@modules/platform/event-bus"
import type { EventConsumerRegistry, EventDelivery } from "@modules/platform/event-bus"
import { ContentAiService } from "./content-ai.service"
import { ContentGenerationCompletionService } from "./content-generation-completion.service"

const build = async () => {
    const content = mock<ContentAiService>()
    content.complete.mockResolvedValue(undefined)
    const registry = mock<EventConsumerRegistry>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContentGenerationCompletionService,
            { provide: ContentAiService, useValue: content },
            { provide: EVENT_CONSUMER_REGISTRY, useValue: registry },
        ],
    }).compile()
    return { service: moduleRef.get(ContentGenerationCompletionService), content, registry }
}

const delivery = (): EventDelivery<AiGenerationCompletedEvent> => {
    const event = AiGenerationCompletedEvent.create({
        generationId: "gen-1",
        workspaceId: "ws-1",
        purpose: "content_draft",
        status: "done",
    })
    return {
        correlationId: "gen-1",
        eventId: event.eventId,
        consumer: "ai_generation_completed__content",
        dedupeKey: "gen-1",
        event,
        attempt: 1,
    }
}

describe("ContentGenerationCompletionService", () => {
    it("subscribes to the content queue of ai_generation_completed", async () => {
        const { service, registry } = await build()

        service.onModuleInit()

        expect(registry.subscribe).toHaveBeenCalledWith("ai_generation_completed__content", service)
    })

    it("asks the content capability to apply the generation with the delivery's inbox key", async () => {
        const { service, content } = await build()

        await expect(service.handle(delivery())).resolves.toBeUndefined()

        expect(content.complete).toHaveBeenCalledWith("ws-1", "gen-1", {
            consumer: "ai_generation_completed__content",
            dedupeKey: "gen-1",
        })
    })

    it("lets a failure reach the bus so the message is retried", async () => {
        const { service, content } = await build()
        const cause = new Error("db down")
        content.complete.mockRejectedValue(cause)

        await expect(service.handle(delivery())).rejects.toBe(cause)
    })
})
