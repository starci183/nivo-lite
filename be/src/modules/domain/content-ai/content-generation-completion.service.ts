import { Injectable } from "@nestjs/common"
import type { GenerationCompletion } from "@modules/domain/ai-generations"
import { VideoScriptingService } from "@modules/domain/video"
import { ContentAiService } from "./content-ai.service"

@Injectable()
/** Applies queued marketing output to the content or video capability that requested it. */
export class ContentGenerationCompletionService implements GenerationCompletion {
    constructor(
        private readonly content: ContentAiService,
        private readonly video: VideoScriptingService,
    ) {}

    /** Each capability ignores generations that it does not own. */
    async completeGeneration(workspaceId: string, generationId: string): Promise<void> {
        await this.content.complete(workspaceId, generationId)
        await this.video.complete(workspaceId, generationId)
    }
}
