import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AiGenerationCompletedEvent } from "@modules/events/api"
import { EVENT_CONSUMER_REGISTRY } from "@modules/platform/event-bus"
import type { EventConsumerRegistry, EventDelivery } from "@modules/platform/event-bus"
import { VideoScriptingService } from "./video-scripting.service"
import { VideoGenerationCompletionService } from "./video-generation-completion.service"

const build = async () => {
    const scripting = mock<VideoScriptingService>()
    scripting.complete.mockResolvedValue(undefined)
    const registry = mock<EventConsumerRegistry>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoGenerationCompletionService,
            { provide: VideoScriptingService, useValue: scripting },
            { provide: EVENT_CONSUMER_REGISTRY, useValue: registry },
        ],
    }).compile()
    return { service: moduleRef.get(VideoGenerationCompletionService), scripting, registry }
}

const delivery = (): EventDelivery<AiGenerationCompletedEvent> => {
    const event = AiGenerationCompletedEvent.create({
        generationId: "gen-1",
        workspaceId: "ws-1",
        purpose: "video_script",
        status: "done",
    })
    return {
        correlationId: "gen-1",
        eventId: event.eventId,
        consumer: "ai_generation_completed__video",
        dedupeKey: "gen-1",
        event,
        attempt: 1,
    }
}

describe("VideoGenerationCompletionService", () => {
    it("subscribes to the video queue of ai_generation_completed", async () => {
        const { service, registry } = await build()

        service.onModuleInit()

        expect(registry.subscribe).toHaveBeenCalledWith("ai_generation_completed__video", service)
    })

    it("asks the video capability to apply the generation with the delivery's inbox key", async () => {
        const { service, scripting } = await build()

        await expect(service.handle(delivery())).resolves.toBeUndefined()

        expect(scripting.complete).toHaveBeenCalledWith("ws-1", "gen-1", {
            consumer: "ai_generation_completed__video",
            dedupeKey: "gen-1",
        })
    })

    it("lets a failure reach the bus so the message is retried", async () => {
        const { service, scripting } = await build()
        const cause = new Error("db down")
        scripting.complete.mockRejectedValue(cause)

        await expect(service.handle(delivery())).rejects.toBe(cause)
    })
})
