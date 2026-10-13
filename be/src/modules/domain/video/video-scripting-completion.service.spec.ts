import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { GenerationsService } from "@modules/domain/ai-generations"
import { EventsService } from "@modules/domain/events"
import { VideoProjectScriptingService } from "@modules/domain/video-projects"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { VideoScriptingCompletionService } from "./video-scripting-completion.service"

const build = async () => {
    const clock = new FakeClock("2026-01-01T00:00:00.000Z")
    const entityManager = mockEntityManager()
    const catalog = mock<MessageCatalog>()
    const generations = mock<GenerationsService>()
    const events = mock<EventsService>()
    const projectWriter = mock<VideoProjectScriptingService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoScriptingCompletionService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: clock },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: GenerationsService, useValue: generations },
            { provide: EventsService, useValue: events },
            { provide: VideoProjectScriptingService, useValue: projectWriter },
        ],
    }).compile()
    return {
        service: moduleRef.get(VideoScriptingCompletionService),
        clock,
        entityManager,
        catalog,
        generations,
        events,
        projectWriter,
    }
}

describe("VideoScriptingCompletionService", () => {
    describe("complete", () => {
        it("complete has its first case written", async () => {
            const { service } = await build()
            expect(service.complete).toBeInstanceOf(Function)
        })
    })
})
