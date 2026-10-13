import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { VideoScriptingService } from "@modules/domain/video"
import { ContentAiService } from "./content-ai.service"
import { ContentGenerationCompletionService } from "./content-generation-completion.service"

const build = async () => {
    const content = mock<ContentAiService>()
    content.complete.mockResolvedValue(undefined)
    const video = mock<VideoScriptingService>()
    video.complete.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContentGenerationCompletionService,
            { provide: ContentAiService, useValue: content },
            { provide: VideoScriptingService, useValue: video },
        ],
    }).compile()
    return { service: moduleRef.get(ContentGenerationCompletionService), content, video }
}

describe("ContentGenerationCompletionService", () => {
    it("asks both the content and video capabilities to apply the generation", async () => {
        const { service, content, video } = await build()

        await expect(service.completeGeneration("ws-1", "gen-1")).resolves.toBeUndefined()

        expect(content.complete).toHaveBeenCalledWith("ws-1", "gen-1")
        expect(video.complete).toHaveBeenCalledWith("ws-1", "gen-1")
    })
})
