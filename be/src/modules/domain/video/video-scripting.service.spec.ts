import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { GenerationsService } from "@modules/domain/ai-generations"
import { VideoProjectScriptingService } from "@modules/domain/video-projects"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { VideoScriptingCompletionService } from "./video-scripting-completion.service"
import { VideoScriptingContextService } from "./video-scripting-context.service"
import { VideoScriptingService } from "./video-scripting.service"

const build = async () => {
    const clock = new FakeClock("2026-01-01T00:00:00.000Z")
    const entityManager = mockEntityManager()
    const members = mock<WorkspaceMembersService>()
    const generations = mock<GenerationsService>()
    const context = mock<VideoScriptingContextService>()
    const projectWriter = mock<VideoProjectScriptingService>()
    const completion = mock<VideoScriptingCompletionService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoScriptingService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: clock },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: GenerationsService, useValue: generations },
            { provide: VideoScriptingContextService, useValue: context },
            { provide: VideoProjectScriptingService, useValue: projectWriter },
            { provide: VideoScriptingCompletionService, useValue: completion },
        ],
    }).compile()
    return {
        service: moduleRef.get(VideoScriptingService),
        clock,
        entityManager,
        members,
        generations,
        context,
        projectWriter,
        completion,
    }
}

describe("VideoScriptingService", () => {
    describe("request", () => {
        it("request has its first case written", async () => {
            const { service } = await build()
            expect(service.request).toBeInstanceOf(Function)
        })
    })

    describe("status", () => {
        it("status has its first case written", async () => {
            const { service } = await build()
            expect(service.status).toBeInstanceOf(Function)
        })
    })

    describe("complete", () => {
        it("complete has its first case written", async () => {
            const { service } = await build()
            expect(service.complete).toBeInstanceOf(Function)
        })
    })
})
